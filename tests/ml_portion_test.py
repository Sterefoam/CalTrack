import importlib.util
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location("mass_training",Path(__file__).resolve().parents[1]/"scripts/ml/train-portion.py")
mass=importlib.util.module_from_spec(spec);spec.loader.exec_module(mass)
mass.torch.set_num_threads(2)


class WeighedMassProtocolTests(unittest.TestCase):
    def test_absolute_error_and_finite_sample_calibration(self):
        result=mass.metrics([100,200],[110,180])
        self.assertEqual(result["maeGrams"],15)
        self.assertEqual(result["within50Grams"],1)
        self.assertEqual(mass.conformal_radius(mass.np.arange(20),mass.np.zeros(20)),18)
        with self.assertRaises(ValueError):mass.conformal_radius([1],[1])

    def test_calibration_capture_days_are_separate_and_official_test_is_preserved(self):
        rows=[]
        for group,part in enumerate(["train","validation","validation","validation","test"]):
            for i in range(20):
                identifier=f"{group}-{i}";official="test" if part=="test" else "train"
                rows.append(dict(id=identifier,grams=100+i,file=f"portion/images/{identifier}.jpg",sha256=identifier,split=part,
                                 groupId=f"{official}:{group}",officialSplit=official,day=str(group)))
        prepared=mass.prepare_split(dict(rows=rows))
        self.assertEqual(prepared["counts"],dict(train=20,validation=40,calibration=20,test=20))
        self.assertEqual(mass.fingerprint(prepared["rows"]),mass.fingerprint(list(reversed(prepared["rows"]))))
        changed=[dict(row) for row in prepared["rows"]]
        changed[0]["day"]=next(row["day"] for row in changed if row["split"]=="calibration")
        with self.assertRaises(ValueError):mass.validate_split(dict(rows=changed))
        changed=[dict(row) for row in prepared["rows"]];changed[-1]["officialSplit"]="train"
        with self.assertRaises(ValueError):mass.validate_split(dict(rows=changed))

    def test_mass_checkpoint_keeps_feature_normalization_and_predictions(self):
        model=mass.MassModel(normalized=True).eval();model.mean.fill_(.01);model.scale.fill_(.5)
        inputs=mass.torch.rand(1,3,224,224)
        with mass.torch.inference_mode():expected=model(inputs)
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/"mass.pt";mass.save_model(path,model,"test-only","test-data")
            restored,_=mass.load_model(path,mass.torch.device("cpu"));restored.eval()
            with mass.torch.inference_mode():actual=restored(inputs)
            mass.torch.testing.assert_close(actual,expected)


if __name__=="__main__":unittest.main()
