"""Offline mass estimate from the validation-selected Nutrition5k RGB experiment."""
import argparse
import importlib.util
import json
from pathlib import Path

spec=importlib.util.spec_from_file_location("portion_training",Path(__file__).with_name("train-portion.py"))
mass=importlib.util.module_from_spec(spec);spec.loader.exec_module(mass)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image",type=Path);parser.add_argument("--run",default="mass-v1")
    args=parser.parse_args()
    if not args.run.replace("-","").replace("_","").isalnum():parser.error("Invalid run directory")
    run=mass.DATA/args.run
    selection=json.loads((run/"selection.json").read_text(encoding="utf-8"))
    selected=selection["selected"]
    mass.torch.set_num_threads(4)
    device=mass.torch.device("cuda" if mass.torch.cuda.is_available() else "cpu")
    if selected["checkpoint"]:
        model,saved=mass.load_model(run/selected["checkpoint"],device)
        if saved["fingerprint"]!=selection["fingerprint"]:raise ValueError("Checkpoint and selected dataset differ")
        with mass.ml.Image.open(args.image) as image:inputs=mass.preprocess()(image.convert("RGB")).unsqueeze(0).to(device)
        model.eval()
        with mass.torch.inference_mode():
            with mass.torch.autocast(device_type=device.type,enabled=device.type=="cuda"):
                log_mass=(model(inputs)+model(inputs.flip(-1)))/2
            prediction=float(mass.grams(log_mass)[0])
    else:prediction=selected["medianGrams"]
    radius=selection["interval"]["radiusGrams"]
    print(json.dumps(dict(experimental=True,productionEnabled=False,estimatedGrams=round(prediction,1),
                          interval=dict(lowerGrams=round(max(.1,prediction-radius),1),upperGrams=round(prediction+radius,1),targetCoverage=.9),
                          domain="Nutrition5k overhead cafeteria RGB capture rig",
                          note="Not a scale. Coverage and gram error are not validated for mobile photos, plate-size changes or Indonesian dishes. No nutrition prediction."),indent=2))


if __name__=="__main__":main()
