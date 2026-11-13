import csv
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("food_collection",Path(__file__).resolve().parents[1]/"scripts/ml/collect-openimages.py")
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)


class AnnotatedFoodSelectionTests(unittest.TestCase):
    def select(self, rows):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/"boxes.csv"
            fields = ["ImageID","LabelName","Confidence","XMin","YMin","XMax","YMax","IsDepiction","IsGroupOf","IsOccluded","IsTruncated"]
            with path.open("w",encoding="utf-8",newline="") as stream:
                writer = csv.DictWriter(stream,fieldnames=fields)
                writer.writeheader();writer.writerows(rows)
            return collector.select_boxes(path,{"apple":"apel","pear":"pir"})

    def row(self, **changes):
        result = dict(ImageID="a"*16,LabelName="apple",Confidence="1",XMin="0.1",YMin="0.1",XMax="0.9",YMax="0.9",
                      IsDepiction="0",IsGroupOf="0",IsOccluded="0",IsTruncated="0")
        return dict(result,**changes)

    def test_retains_partial_photos_and_largest_box_but_rejects_mixed_foods(self):
        boxes = self.select([self.row(XMax="0.6"),self.row(IsOccluded="1",IsTruncated="1")])
        self.assertEqual(boxes["a"*16][1],[0.1,0.1,0.9,0.9])
        self.assertTrue(boxes["a"*16][3]["IsOccluded"])
        self.assertEqual(self.select([self.row(),self.row(LabelName="pear")]),{})

    def test_rejects_negative_labels_depictions_tiny_boxes_and_invalid_source_ids(self):
        for changes in ({"Confidence":"0"},{"IsDepiction":"1"},{"XMax":"0.2","YMax":"0.2"},{"ImageID":"../outside"}):
            with self.subTest(changes=changes):
                self.assertEqual(self.select([self.row(**changes)]),{})


if __name__ == "__main__":unittest.main()
