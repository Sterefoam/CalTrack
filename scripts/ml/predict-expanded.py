"""Predict using the validation-selected v2 model, without network or nutrition claims."""
import argparse
import importlib.util
import json
from pathlib import Path

spec = importlib.util.spec_from_file_location("food_training", Path(__file__).with_name("train-expanded.py"))
ml = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ml)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path)
    parser.add_argument("--run", default="v2")
    args = parser.parse_args()
    if not args.run.replace("-", "").replace("_", "").isalnum(): parser.error("Invalid run directory")
    run = ml.DATA / args.run
    selection = json.loads((run / "selection.json").read_text(encoding="utf-8"))
    device = ml.torch.device("cuda" if ml.torch.cuda.is_available() else "cpu")
    ml.torch.set_num_threads(4)
    combined = None
    with ml.Image.open(args.image) as image:
        rgb = image.convert("RGB")
    for weight, candidate in zip(selection["selected"]["weights"], selection["candidates"]):
        if not weight: continue
        model, checkpoint = ml.checkpoint_model(run / candidate["checkpoint"], device)
        inputs = ml.ARCHITECTURES[checkpoint["architecture"]][1].transforms()(rgb).unsqueeze(0).to(device)
        model.eval()
        with ml.torch.inference_mode():
            logits = (model(inputs) + model(inputs.flip(-1))) / 2
            probability = (logits / selection["selected"]["temperature"]).softmax(1).cpu()[0]
        combined = weight * probability if combined is None else combined + weight * probability
        del model
    values, indices = combined.topk(min(3,len(selection["labels"])))
    print(json.dumps(dict(experimental=True,productionEnabled=False,
                          candidates=[dict(label=selection["labels"][index],score=float(value)) for value,index in zip(values,indices)],
                          note="Closed-set, uncalibrated scores. Confirm the dish; no portion weight or nutrition prediction."),ensure_ascii=False,indent=2))


if __name__ == "__main__": main()
