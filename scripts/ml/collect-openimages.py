"""Collect licensed, annotated food crops from official Open Images v5 metadata.

Original dataset subset names do not define the downstream CalTrack partitions.
One crop / one target label per source photograph prevents crop-level leakage.
"""
import argparse
import concurrent.futures
import csv
import hashlib
import http.client
import io
import json
from pathlib import Path
import random
import re
import sys
import time
import threading
import urllib.error
import urllib.request
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2] / ".caltrack" / "ml"
sys.path.insert(0, str(ROOT / "python-packages"))
from PIL import Image, ImageOps

LABELS = {
    "Apple": "apel", "Banana": "pisang", "Orange": "jeruk", "Grape": "anggur",
    "Mango": "mangga", "Pineapple": "nanas", "Strawberry": "stroberi", "Watermelon": "semangka",
    "Grapefruit": "grapefruit", "Croissant": "croissant", "Hot dog": "hotdog",
    "Waffle": "waffle", "Pancake": "pancake", "Popcorn": "popcorn", "Burrito": "burrito",
    "Cheese": "keju", "Cookie": "kukis", "French fries": "kentang-goreng",
    "Pasta": "pasta", "Pizza": "pizza", "Submarine sandwich": "sandwich-sub",
    "Sushi": "sushi", "Taco": "taco", "Bread": "roti", "Hamburger": "burger",
    "Ice cream": "es-krim", "Salad": "salad", "Doughnut": "donat",
    "Cucumber": "mentimun", "Pretzel": "pretzel", "Muffin": "muffin", "Tart": "tart",
    "Potato": "kentang", "Pear": "pir", "Tomato": "tomat", "Lemon": "lemon",
    "Peach": "persik", "Coconut": "kelapa", "Cabbage": "kubis", "Carrot": "wortel",
    "Broccoli": "brokoli", "Bell pepper": "paprika",
}
BASE = "https://storage.googleapis.com/openimages/"
Image.MAX_IMAGE_PIXELS = 45_000_000
CONNECTIONS = threading.local()


def bounded_download(url, limit):
    # Reuse four TLS connections for image batches, retaining the same bounded
    # concurrency and rate-limit handling. Metadata still uses urllib below.
    parsed = urlsplit(url)
    if parsed.hostname == "open-images-dataset.s3.amazonaws.com":
        if not getattr(CONNECTIONS,"s3",None):
            CONNECTIONS.s3 = http.client.HTTPSConnection(parsed.hostname,timeout=30)
        connection = CONNECTIONS.s3
        try:
            connection.request("GET", parsed.path, headers={"User-Agent":"CalTrack-Research/0.2"})
            response = connection.getresponse()
            if response.status != 200:
                raise urllib.error.HTTPError(url,response.status,response.reason,response.headers,None)
            if int(response.getheader("Content-Length","0")) > limit:
                raise ValueError("Response exceeds size limit")
            data = response.read(limit+1)
            if len(data) > limit: raise ValueError("Response exceeds size limit")
            return data
        except Exception:
            connection.close(); CONNECTIONS.s3 = None
            raise
    request = urllib.request.Request(url, headers={"User-Agent": "CalTrack-Research/0.2 (licensed food-image study)"})
    with urllib.request.urlopen(request, timeout=30) as response:
        if int(response.headers.get("Content-Length", "0")) > limit:
            raise ValueError("Response exceeds size limit")
        data = response.read(limit + 1)
        if len(data) > limit:
            raise ValueError("Response exceeds size limit")
        return data


def cached_metadata(path, remote, limit):
    if not path.exists():
        data = bounded_download(BASE + remote, limit)
        temporary = path.with_suffix(".tmp")
        temporary.write_bytes(data)
        replace_with_retry(temporary,path)
    return path


def replace_with_retry(temporary,path):
    for attempt in range(10):
        try:
            temporary.replace(path)
            return
        except PermissionError:
            if attempt == 9: raise
            time.sleep(0.2*(attempt+1))


def atomic_json(path, value):
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    replace_with_retry(temporary,path)


def select_boxes(path, mapping):
    boxes = {}
    with path.open(encoding="utf-8", newline="") as stream:
        for row in csv.DictReader(stream):
            if row["LabelName"] not in mapping or row["Confidence"] != "1" or not re.fullmatch(r"[0-9a-f]{16}", row["ImageID"]):
                continue
            if row["IsDepiction"] != "0":
                continue
            coordinates = [float(row[name]) for name in ("XMin", "YMin", "XMax", "YMax")]
            x1, y1, x2, y2 = coordinates
            area = (x2-x1)*(y2-y1)
            if not (0 <= x1 < x2 <= 1 and 0 <= y1 < y2 <= 1) or area < 0.15:
                continue
            flags = {name:row[name] == "1" for name in ("IsGroupOf","IsOccluded","IsTruncated")}
            boxes.setdefault(row["ImageID"], []).append((mapping[row["LabelName"]], coordinates, area, flags))
    # Reject mixed target foods. Retain the largest box if several instances of one food.
    return {key: max(value, key=lambda box: box[2]) for key, value in boxes.items() if len({box[0] for box in value}) == 1}


def crop_record(job):
    subset, metadata, label, coordinates, _, flags = job
    image_id = metadata["ImageID"]
    url = f"https://open-images-dataset.s3.amazonaws.com/{subset}/{image_id}.jpg"
    data = bounded_download(url, 12_000_000)
    source_hash = hashlib.sha256(data).hexdigest()
    with Image.open(io.BytesIO(data)) as source:
        # Official S3 images already carry the Open Images rotation correction.
        image = source.convert("RGB")
        width, height = image.size
        if width * height > Image.MAX_IMAGE_PIXELS:
            raise ValueError("Source image pixel limit exceeded")
        x1, y1, x2, y2 = coordinates
        box = (round(x1*width), round(y1*height), round(x2*width), round(y2*height))
        if min(box[2]-box[0], box[3]-box[1]) < 96:
            raise ValueError("Food crop smaller than 96 pixels")
        crop = image.crop(box)
        crop.thumbnail((512,512), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        crop.save(output, format="JPEG", quality=90)
        normalized = output.getvalue()
    gray = list(crop.resize((9,8)).convert("L").get_flattened_data())
    dhash = 0
    for y in range(8):
        for x in range(8):
            dhash = (dhash << 1) | int(gray[y*9+x] > gray[y*9+x+1])
    identifier = "oi-" + image_id
    destination = ROOT / "images" / f"{identifier}.jpg"
    destination.write_bytes(normalized)
    return dict(id=identifier, label=label, file=f"images/{identifier}.jpg", source="Open Images v5",
                sourceImageId="openimages:"+image_id, sourceImageSha256=source_hash, sourceSubset=subset,
                title=metadata["Title"], sourceUrl=metadata["OriginalLandingURL"], originalUrl=metadata["OriginalURL"],
                downloadUrl=url, author=metadata["Author"], authorUrl=metadata["AuthorProfileURL"],
                license=dict(name="CC BY 2.0", url=metadata["License"], author=metadata["Author"]),
                boundingBox=dict(zip(("xMin","yMin","xMax","yMax"),coordinates)),
                annotationFlags=flags,
                sha256=hashlib.sha256(normalized).hexdigest(), dhash=f"{dhash:016x}",
                labelStatus="openimages-human-box-annotation-unreviewed-locally",
                modifications="Single annotated food crop; resized <=512px; JPEG re-encoded; metadata stripped",
                retrievedAt=__import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--per-class", type=int, default=100)
    args = parser.parse_args()
    if not 30 <= args.per_class <= 500:
        parser.error("per-class must be 30-500")
    directory = ROOT / "openimages"
    directory.mkdir(parents=True, exist_ok=True)
    (ROOT / "images").mkdir(exist_ok=True)
    classes = cached_metadata(directory/"classes.csv", "v5/class-descriptions-boxable.csv", 100_000)
    with classes.open(encoding="utf-8") as stream:
        mapping = {identifier:LABELS[name] for identifier,name in csv.reader(stream) if name in LABELS}
    jobs = []
    for subset in ("validation", "test"):
        boxes_path = cached_metadata(directory/f"{subset}-boxes.csv", f"v5/{subset}-annotations-bbox.csv", 90_000_000)
        images_path = cached_metadata(directory/f"{subset}-images.csv", f"2018_04/{subset}/{subset}-images-with-rotation.csv", 55_000_000)
        boxes = select_boxes(boxes_path, mapping)
        with images_path.open(encoding="utf-8", newline="") as stream:
            for row in csv.DictReader(stream):
                if row["ImageID"] not in boxes:
                    continue
                if row["License"].rstrip("/") not in ("https://creativecommons.org/licenses/by/2.0", "http://creativecommons.org/licenses/by/2.0"):
                    continue
                if not row["Author"].strip() or not row["OriginalLandingURL"].startswith(("https://","http://")):
                    continue
                label, coordinates, area, flags = boxes[row["ImageID"]]
                jobs.append((subset,row,label,coordinates,area,flags))
        print(json.dumps(dict(stage="metadata", subset=subset, foodImages=len(boxes), licensedCandidates=len(jobs))),flush=True)
    manifest_path = ROOT / "manifest-openimages.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {"records":[],"errors":[]}
    records = {row["id"]:row for row in manifest["records"]}
    errors = manifest.get("errors",[])
    random.Random(20261113).shuffle(jobs)
    counts = {label:sum(row["label"] == label for row in records.values()) for label in LABELS.values()}
    # Fill annotation flags for records collected before the relaxed visibility filter.
    for job in jobs:
        key = "oi-"+job[1]["ImageID"]
        if key in records: records[key]["annotationFlags"] = job[5]
    def checkpoint():
        atomic_json(manifest_path,dict(source="Open Images v5", perClass=args.per_class,
                                      records=list(records.values()), counts=counts, errors=errors,
                                      selection="One target label and largest eligible box per photograph; area >=15%; no depictions; partial visibility and groups accepted and recorded",
                                      sourceMetadata=[BASE+f"v5/{s}-annotations-bbox.csv" for s in ("validation","test")]))
    # Bounded four-worker batches. A provider throttle stops collection rather than rotating endpoints.
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        for label in sorted(counts):
            available = [job for job in jobs if job[2] == label and "oi-"+job[1]["ImageID"] not in records]
            for offset in range(0,len(available),4):
                if counts[label] >= args.per_class:
                    break
                batch = available[offset:offset+min(4,args.per_class-counts[label])]
                futures = {executor.submit(crop_record,job):job for job in batch}
                for future in concurrent.futures.as_completed(futures):
                    job = futures[future]
                    try:
                        row = future.result(); records[row["id"]] = row; counts[label] += 1
                    except Exception as error:
                        errors.append(dict(id=job[1]["ImageID"],label=label,reason=str(error)))
                        if isinstance(error,urllib.error.HTTPError) and error.code in (429,503):
                            checkpoint()
                            raise RuntimeError("Provider throttled downloads; resume later respecting Retry-After") from error
                checkpoint()
                time.sleep(0.2)
            checkpoint()
            print(json.dumps(dict(label=label,images=counts[label],total=len(records),errors=len(errors))),flush=True)


if __name__ == "__main__":
    main()
