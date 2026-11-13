import importlib.util
from pathlib import Path
import sys
import unittest

spec = importlib.util.spec_from_file_location("refinement_test", Path(__file__).resolve().parents[1] / "scripts/ml/train-refinement.py")
refinement = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = refinement
spec.loader.exec_module(refinement)


class RefinementProtocolTests(unittest.TestCase):
    def fixture(self):
        rows = [dict(id=part, label="rice", sha256=part, groupId=part, split=part, fresh=part == "test", file=f"images/{part}.jpg") for part in ("train", "validation", "test")]
        return dict(rows=rows, labels=["rice"]), dict(rows=[dict(row) for row in rows[:2]], counts={"rice": {}})

    def test_fresh_test_and_immutable_old_partitions(self):
        split, previous = self.fixture()
        refinement.validate(split, previous)
        split["rows"][1]["split"] = "train"
        with self.assertRaisesRegex(ValueError, "Old data partition"):
            refinement.validate(split, previous)

    def test_known_test_and_source_leakage_are_rejected(self):
        split, previous = self.fixture()
        previous["rows"].append(dict(split["rows"][2]))
        with self.assertRaisesRegex(ValueError, "test must be fresh"):
            refinement.validate(split, previous)
        split, previous = self.fixture()
        for row in split["rows"]:
            row["sourceImageId"] = "same-original"
        with self.assertRaisesRegex(ValueError, "leakage"):
            refinement.validate(split, previous)


if __name__ == "__main__":
    unittest.main()
