import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("food_training", Path(__file__).resolve().parents[1] / "scripts/ml/train-expanded.py")
training = importlib.util.module_from_spec(spec)
spec.loader.exec_module(training)
training.torch.set_num_threads(2)


class TrainingProtocolTests(unittest.TestCase):
    def test_metrics_have_correct_support_topk_and_interval(self):
        result = training.scores(training.np.array([[.8,.2],[.6,.4],[.1,.9]]), training.np.array([0,1,1]), ["rice","soup"])
        self.assertEqual(result["correct"], 2)
        self.assertEqual(result["top1"], 2/3)
        self.assertEqual(result["top3"], 1)
        self.assertEqual(result["perClass"][1]["support"], 2)
        self.assertLess(result["wilson95"][0], result["top1"])
        self.assertGreater(result["wilson95"][1], result["top1"])

    def test_unmeasured_legacy_classes_have_no_claimed_recall(self):
        result = training.scores(training.np.array([[.1,.8,.1],[.2,.7,.1]]),training.np.array([1,1]),["legacy","new","other"])
        self.assertEqual(result["measuredClasses"],1)
        self.assertIsNone(result["perClass"][0]["recall"])
        self.assertIsNone(result["perClass"][0]["f1"])
        self.assertEqual(result["macroF1"],1)

    def test_dataset_rejects_duplicate_leakage_and_is_order_independent(self):
        rows = [dict(id=part,sha256=part,label="rice",split=part,groupId=part,file=f"images/{part}.jpg") for part in ("train","validation","test")]
        split = dict(rows=rows,counts={"rice": {}})
        self.assertEqual(training.validate_partition(split), ["rice"])
        self.assertEqual(training.fingerprint(rows), training.fingerprint(list(reversed(rows))))
        changed = [dict(row) for row in rows]
        changed[2]["groupId"] = "train"
        with self.assertRaises(ValueError): training.validate_partition(dict(split,rows=changed))
        changed = [dict(row,sourceImageId="same-photo") for row in rows]
        with self.assertRaises(ValueError): training.validate_partition(dict(split,rows=changed))

    def test_normalized_probe_checkpoint_restores_identical_predictions(self):
        model = training.make_model("efficientnet_b0", 2).eval()
        probe = training.NormalizedProbe(model).eval()
        inputs = training.torch.rand(1,3,224,224)
        with training.torch.inference_mode(): expected = probe(inputs)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "probe.pt"
            training.atomic_torch(path, dict(architecture="efficientnet_b0",labels=["rice","soup"],state=model.state_dict(),kind="frozen-normalized-linear-probe"))
            restored, _ = training.checkpoint_model(path, training.torch.device("cpu"))
            restored.eval()
            with training.torch.inference_mode(): actual = restored(inputs)
            training.torch.testing.assert_close(actual, expected)


if __name__ == "__main__": unittest.main()
