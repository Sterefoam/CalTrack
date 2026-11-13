"""Predict with the validation-selected v3 ensemble; no portion or nutrition claim."""
import argparse
import importlib.util
import json
from pathlib import Path
import sys

spec = importlib.util.spec_from_file_location("refinement", Path(__file__).with_name("train-refinement.py"))
refinement = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = refinement
spec.loader.exec_module(refinement)
ml = refinement.ml


def image_probability(image, path, preprocess, temperature, device):
    model, _ = ml.checkpoint_model(path, device)
    inputs = preprocess(image).unsqueeze(0).to(device)
    model.eval()
    with ml.torch.inference_mode():
        logits = (model(inputs) + model(inputs.flip(-1))) / 2
        result = (logits / temperature).softmax(1).cpu()[0]
    del model
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path)
    args = parser.parse_args()
    run = ml.DATA / "v3"
    selection = json.loads((run / "selection.json").read_text(encoding="utf-8"))
    baseline = json.loads((ml.DATA / "v2/selection.json").read_text(encoding="utf-8"))
    if selection["labels"] != baseline["labels"]:
        raise ValueError("Different class order")
    ml.torch.set_num_threads(4)
    device = ml.torch.device("cuda" if ml.torch.cuda.is_available() else "cpu")
    with ml.Image.open(args.image) as image:
        rgb = image.convert("RGB")
    combined = ml.torch.zeros(len(selection["labels"]))
    for outer, candidate in zip(selection["selected"]["weights"], selection["candidates"]):
        if not outer:
            continue
        if candidate["kind"] == "frozen-v2-ensemble":
            for weight, old in zip(baseline["selected"]["weights"], baseline["candidates"]):
                if not weight:
                    continue
                architecture = old["architecture"]
                probability = image_probability(rgb, ml.DATA / "v2" / old["checkpoint"], ml.ARCHITECTURES[architecture][1].transforms(), baseline["selected"]["temperature"], device)
                combined += outer * weight * probability
        else:
            combined += outer * image_probability(rgb, run / candidate["checkpoint"], refinement.transform(), 1, device)
    values, indices = combined.topk(min(3, len(selection["labels"])))
    print(json.dumps(dict(experimental=True, productionEnabled=False,
                          candidates=[dict(label=selection["labels"][index], score=float(value)) for value, index in zip(values, indices)],
                          note="Closed-set, uncalibrated scores. Confirm the dish. This model does not predict grams or nutrition."), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
