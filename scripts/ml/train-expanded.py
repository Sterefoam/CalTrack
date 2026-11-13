"""Local GPU experiment. Model selection sees validation only; final test is sealed once."""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import random
import sys
import time

PROJECT = Path(__file__).resolve().parents[2]
DATA = PROJECT / ".caltrack" / "ml"
sys.path.insert(0, str(DATA / "python-packages"))
os.environ.setdefault("TORCH_HOME", str(DATA / "torch-cache"))
os.environ.setdefault("CUBLAS_WORKSPACE_CONFIG", ":4096:8")

import numpy as np
from PIL import Image
import torch
from torch import nn
from torch.utils.data import Dataset, DataLoader
from torchvision import models, transforms
from torchvision.transforms import InterpolationMode

ARCHITECTURES = {
    "efficientnet_b0": (models.efficientnet_b0, models.EfficientNet_B0_Weights.IMAGENET1K_V1),
    "convnext_tiny": (models.convnext_tiny, models.ConvNeXt_Tiny_Weights.IMAGENET1K_V1),
}


def replace_with_retry(temporary,path):
    for attempt in range(10):
        try:
            temporary.replace(path)
            return
        except PermissionError:
            if attempt == 9: raise
            time.sleep(0.2*(attempt+1))


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    replace_with_retry(temporary,path)


def atomic_torch(path, value):
    temporary = path.with_suffix(path.suffix + ".tmp")
    torch.save(value, temporary)
    replace_with_retry(temporary,path)


def fingerprint(rows):
    payload = [{key: row[key] for key in ("id", "sha256", "label", "split", "groupId")} for row in sorted(rows, key=lambda r: r["id"])]
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def validate_partition(split):
    seen_ids, seen_groups, seen_hashes, seen_sources = set(), {}, {}, {}
    for row in split["rows"]:
        if row["id"] in seen_ids or row["split"] not in ("train", "validation", "test"):
            raise ValueError("Invalid or duplicate dataset row")
        seen_ids.add(row["id"])
        for mapping, key in ((seen_groups, row["groupId"]), (seen_hashes, row["sha256"])):
            if key in mapping and mapping[key] != row["split"]:
                raise ValueError("Dataset leakage across partitions")
            mapping[key] = row["split"]
        for key in (row.get("sourceImageId"), row.get("sourceImageSha256")):
            if key and key in seen_sources and seen_sources[key] != row["split"]:
                raise ValueError("Source photograph leakage across partitions")
            if key: seen_sources[key] = row["split"]
        path = (DATA / row["file"]).resolve()
        if DATA.resolve() not in path.parents:
            raise ValueError("Image path outside dataset")
    labels = sorted(split["counts"])
    for label in labels:
        parts = ("train",) if split["counts"][label].get("coverage") == "legacy-train-only-unmeasured" else ("train", "validation", "test")
        for part in parts:
            if not any(row["label"] == label and row["split"] == part for row in split["rows"]):
                raise ValueError(f"Empty {label}/{part}")
    return labels


def verify_images(rows):
    for row in rows:
        if hashlib.sha256((DATA / row["file"]).read_bytes()).hexdigest() != row["sha256"]:
            raise ValueError(f"Image changed since collection: {row['id']}")


class FoodImages(Dataset):
    def __init__(self, rows, labels, transform):
        self.rows, self.labels, self.transform = rows, labels, transform

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, index):
        row = self.rows[index]
        with Image.open(DATA / row["file"]) as image:
            pixels = self.transform(image.convert("RGB"))
        return pixels, self.labels.index(row["label"])


def make_loader(rows, labels, transform, args, shuffle=False):
    generator = torch.Generator().manual_seed(args.seed)
    return DataLoader(FoodImages(rows, labels, transform), batch_size=args.batch_size, shuffle=shuffle,
                      num_workers=args.workers, pin_memory=torch.cuda.is_available(),
                      persistent_workers=args.workers > 0, generator=generator)


def make_model(architecture, classes, pretrained=False):
    constructor, weights = ARCHITECTURES[architecture]
    model = constructor(weights=weights if pretrained else None)
    old = model.classifier[-1]
    model.classifier[-1] = nn.Linear(old.in_features, classes)
    return model


def scores(probabilities, truth, labels):
    predicted = probabilities.argmax(axis=1)
    confusion = np.zeros((len(labels), len(labels)), dtype=np.int64)
    np.add.at(confusion, (truth, predicted), 1)
    per_class = []
    for i, label in enumerate(labels):
        support, guessed, tp = int(confusion[i].sum()), int(confusion[:, i].sum()), int(confusion[i, i])
        precision, recall = tp / guessed if guessed else 0.0, tp / support if support else 0.0
        per_class.append(dict(label=label, support=support, precision=precision if support else None,
                              recall=recall if support else None,
                              f1=(2 * precision * recall / (precision + recall) if precision + recall else 0.0) if support else None))
    n, correct = len(truth), int((predicted == truth).sum())
    accuracy = correct / n if n else 0.0
    z = 1.96
    denominator = 1 + z*z/n if n else 1
    center = (accuracy + z*z/(2*n))/denominator if n else 0
    radius = z * math.sqrt(accuracy*(1-accuracy)/n + z*z/(4*n*n))/denominator if n else 0
    top3 = np.argsort(probabilities, axis=1)[:, -min(3, len(labels)):]
    return dict(samples=n, correct=correct, top1=accuracy, top3=float((top3 == truth[:, None]).any(axis=1).mean()),
                macroF1=float(np.mean([row["f1"] for row in per_class if row["support"]])),
                measuredClasses=sum(row["support"] > 0 for row in per_class),
                wilson95=[max(0.0, center-radius), min(1.0, center+radius)],
                perClass=per_class, confusion=confusion.tolist())


def compact(result):
    return {key: result[key] for key in ("samples", "top1", "top3", "macroF1")}


def predict_logits(model, loader, device, tta=False):
    model.eval()
    outputs, targets = [], []
    with torch.inference_mode():
        for inputs, truth in loader:
            inputs = inputs.to(device)
            with torch.autocast(device_type=device.type, enabled=device.type == "cuda"):
                logits = model(inputs)
                if tta:
                    logits = (logits + model(inputs.flip(-1))) / 2
            outputs.append(logits.float().cpu())
            targets.append(truth)
    return torch.cat(outputs), torch.cat(targets).numpy()


def load_checkpoint(path, device):
    checkpoint = torch.load(path, map_location="cpu", weights_only=True)
    model = make_model(checkpoint["architecture"], len(checkpoint["labels"]))
    model.load_state_dict(checkpoint["state"])
    return model.to(device), checkpoint


def train_linear_probe(rows, validation, labels, args, run, device, digest):
    path = run / "linear-probe-best.pt"
    if path.exists():
        saved = torch.load(path, map_location="cpu", weights_only=True)
        if saved["fingerprint"] != digest:
            raise ValueError("Existing probe belongs to another dataset; select a new run directory")
        return path
    model = make_model("efficientnet_b0", len(labels), pretrained=True).to(device).eval()
    head = model.classifier[-1]
    model.classifier = nn.Identity()
    preprocess = ARCHITECTURES["efficientnet_b0"][1].transforms()
    matrices = []
    for split_rows in (rows, validation):
        loader = make_loader(split_rows, labels, preprocess, args)
        features, target = predict_logits(model, loader, device)
        matrices.append((nn.functional.normalize(features, dim=1).to(device), torch.tensor(target, device=device)))
    (x, y), (vx, vy) = matrices
    counts = torch.bincount(y, minlength=len(labels)).float()
    weights = (counts.sum() / counts).sqrt(); weights /= weights.mean()
    best = None
    for regularization in (0.0001, 0.001, 0.01):
        torch.manual_seed(args.seed)
        probe = nn.Linear(x.shape[1], len(labels)).to(device)
        optimizer = torch.optim.LBFGS(probe.parameters(), lr=1, max_iter=120, line_search_fn="strong_wolfe")
        def closure():
            optimizer.zero_grad()
            loss = nn.functional.cross_entropy(probe(x), y, weight=weights) + regularization * probe.weight.square().sum() / 2
            loss.backward()
            return loss
        optimizer.step(closure)
        with torch.no_grad():
            result = scores(probe(vx).softmax(1).cpu().numpy(), vy.cpu().numpy(), labels)
        print(json.dumps(dict(stage="linear-probe", regularization=regularization, validation=compact(result))), flush=True)
        if best is None or (result["macroF1"], result["top1"]) > best[0]:
            best = ((result["macroF1"], result["top1"]), {k: v.detach().cpu().clone() for k,v in probe.state_dict().items()}, regularization)
    # Normalization is part of the probe and is represented explicitly in the checkpoint.
    model.classifier = nn.Sequential(nn.Dropout(p=0.2, inplace=True), head)
    head.load_state_dict(best[1])
    atomic_torch(path, dict(architecture="efficientnet_b0", labels=labels, state=model.cpu().state_dict(),
                            fingerprint=digest, seed=args.seed, kind="frozen-normalized-linear-probe", regularization=best[2]))
    return path


class NormalizedProbe(nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, inputs):
        features = self.model.avgpool(self.model.features(inputs)).flatten(1)
        return self.model.classifier[-1](nn.functional.normalize(features, dim=1))


def checkpoint_model(path, device):
    model, saved = load_checkpoint(path, device)
    if saved.get("kind") == "frozen-normalized-linear-probe":
        model = NormalizedProbe(model).to(device)
    return model, saved


def train_network(architecture, training, validation, labels, args, run, device, digest):
    best_path, finished = run / f"{architecture}-best.pt", run / f"{architecture}-finished.json"
    if finished.exists():
        if json.loads(finished.read_text())["fingerprint"] != digest:
            raise ValueError("Existing training belongs to another dataset")
        return best_path
    torch.manual_seed(args.seed)
    random.seed(args.seed); np.random.seed(args.seed)
    model = make_model(architecture, len(labels), pretrained=True).to(device)
    augment = transforms.Compose([
        transforms.RandomResizedCrop(224, scale=(0.65, 1.0), interpolation=InterpolationMode.BICUBIC),
        transforms.RandomHorizontalFlip(), transforms.RandomRotation(10),
        transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.15),
        transforms.ToTensor(), transforms.Normalize([0.485,0.456,0.406], [0.229,0.224,0.225]),
        transforms.RandomErasing(p=0.1, scale=(0.02,0.08)),
    ])
    train_loader = make_loader(training, labels, augment, args, shuffle=True)
    val_loader = make_loader(validation, labels, ARCHITECTURES[architecture][1].transforms(), args)
    counts = torch.tensor([sum(row["label"] == label for row in training) for label in labels], dtype=torch.float, device=device)
    class_weights = (counts.sum() / counts).sqrt(); class_weights /= class_weights.mean()
    criterion = nn.CrossEntropyLoss(weight=class_weights, label_smoothing=0.05)
    optimizer = torch.optim.AdamW([
        dict(params=model.features.parameters(), lr=0.00015 if architecture == "efficientnet_b0" else 0.00005),
        dict(params=model.classifier.parameters(), lr=0.001),
    ], weight_decay=0.01)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs, eta_min=0.000005)
    scaler = torch.amp.GradScaler("cuda", enabled=device.type == "cuda")
    history, best_key, stale = [], (-1.0,-1.0), 0
    for epoch in range(args.epochs):
        started = time.monotonic()
        for parameter in model.features.parameters():
            parameter.requires_grad = epoch >= 2
        model.train()
        if epoch < 2:
            model.features.eval()
        total_loss = 0.0
        for step, (inputs, truth) in enumerate(train_loader):
            inputs, truth = inputs.to(device), truth.to(device)
            optimizer.zero_grad(set_to_none=True)
            with torch.autocast(device_type=device.type, enabled=device.type == "cuda"):
                loss = criterion(model(inputs), truth)
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            scaler.step(optimizer); scaler.update()
            total_loss += loss.item() * len(truth)
            if (step+1) % 50 == 0:
                print(json.dumps(dict(stage="training", architecture=architecture, epoch=epoch+1, batch=step+1, batches=len(train_loader))), flush=True)
        scheduler.step()
        logits, truth = predict_logits(model, val_loader, device)
        result = scores(logits.softmax(1).numpy(), truth, labels)
        key = (result["macroF1"], result["top1"])
        record = dict(epoch=epoch+1, loss=total_loss/len(training), validation=compact(result), seconds=round(time.monotonic()-started,2))
        history.append(record)
        print(json.dumps(dict(architecture=architecture, **record)), flush=True)
        if key > best_key:
            best_key, stale = key, 0
            atomic_torch(best_path, dict(architecture=architecture, labels=labels, state=model.state_dict(),
                                        fingerprint=digest, seed=args.seed, kind="fine-tuned", epoch=epoch+1))
        else:
            stale += 1
        atomic_json(run / f"{architecture}-history.json", history)
        if epoch >= 9 and stale >= args.patience:
            break
    atomic_json(finished, dict(fingerprint=digest, epochs=len(history), bestValidationMacroF1=best_key[0]))
    del model, optimizer
    if device.type == "cuda": torch.cuda.empty_cache()
    return best_path


def train(args, run, split, labels, device):
    if (run / "report.json").exists():
        raise ValueError("This run's test is already evaluated. Use a new run and a fresh holdout for further selection.")
    digest = fingerprint(split["rows"])
    atomic_json(run / "dataset.json", dict(fingerprint=digest, protocol=split["protocol"], counts=split["counts"],
                                           rows=[{k:r[k] for k in ("id","label","split","sha256","groupId")} for r in split["rows"]]))
    training = [row for row in split["rows"] if row["split"] == "train"]
    validation = [row for row in split["rows"] if row["split"] == "validation"]
    paths = [train_linear_probe(training, validation, labels, args, run, device, digest)]
    for architecture in args.architectures:
        paths.append(train_network(architecture, training, validation, labels, args, run, device, digest))
    logits_list, candidates = [], []
    for path in paths:
        model, saved = checkpoint_model(path, device)
        loader = make_loader(validation, labels, ARCHITECTURES[saved["architecture"]][1].transforms(), args)
        logits, truth = predict_logits(model, loader, device, tta=True)
        logits_list.append(logits)
        result = scores(logits.softmax(1).numpy(), truth, labels)
        candidates.append(dict(checkpoint=path.name, architecture=saved["architecture"], kind=saved["kind"], validation=compact(result)))
        del model
    best, combinations = None, []
    if len(paths) == 3:
        combinations = [(a/4,b/4,(4-a-b)/4) for a in range(5) for b in range(5-a)]
    else:
        combinations = [tuple(1.0 if j == i else 0.0 for j in range(len(paths))) for i in range(len(paths))]
    for weights in combinations:
        for temperature in (0.75, 1.0, 1.5, 2.0):
            probabilities = sum(weight * (logits/temperature).softmax(1) for weight,logits in zip(weights,logits_list))
            result = scores(probabilities.numpy(), truth, labels)
            key = (result["macroF1"],result["top1"])
            if best is None or key > best[0]:
                best = (key, dict(weights=list(weights), temperature=temperature, validation=compact(result)))
    selection = dict(protocol=split["protocol"], fingerprint=digest, labels=labels, candidates=candidates, selected=best[1],
                     selectionMetric="validation macro-F1 over labels with validation support, then validation top-1", tta="center crop + horizontal flip logits average",
                     epochsLimit=args.epochs, patience=args.patience, seed=args.seed, ensembleConfigurations=len(combinations)*4,
                     device=str(device), gpu=torch.cuda.get_device_name() if device.type == "cuda" else None,
                     torch=torch.__version__, torchvision=__import__("torchvision").__version__, testAccessed=False)
    atomic_json(run / "selection.json", selection)
    print(json.dumps(dict(stage="selection-finished", selected=selection["selected"], testAccessed=False)), flush=True)


def evaluate(args, run, split, labels, device):
    report_path = run / "report.json"
    if report_path.exists():
        raise ValueError("Final test report is sealed; do not select another model using its scores.")
    selection = json.loads((run / "selection.json").read_text(encoding="utf-8"))
    if selection["fingerprint"] != fingerprint(split["rows"]) or selection["labels"] != labels:
        raise ValueError("Dataset changed after model selection")
    test_rows = [row for row in split["rows"] if row["split"] == "test"]
    probabilities, individual = [], []
    for candidate in selection["candidates"]:
        model, saved = checkpoint_model(run / candidate["checkpoint"], device)
        loader = make_loader(test_rows, labels, ARCHITECTURES[saved["architecture"]][1].transforms(), args)
        logits, truth = predict_logits(model, loader, device, tta=True)
        probabilities.append((logits/selection["selected"]["temperature"]).softmax(1).numpy())
        individual.append(dict(checkpoint=candidate["checkpoint"], metrics=scores(logits.softmax(1).numpy(),truth,labels)))
        del model
    combined = sum(weight*probability for weight,probability in zip(selection["selected"]["weights"],probabilities))
    subgroups = {}
    masks = {"openImagesCrops": [row.get("source") == "Open Images v5" for row in test_rows],
             "commonsFullImages": [row.get("source") != "Open Images v5" for row in test_rows],
             "partialOrGroupedFood": [any(row.get("annotationFlags",{}).values()) for row in test_rows]}
    for name,mask in masks.items():
        if any(mask): subgroups[name] = scores(combined[mask],truth[mask],labels)
    report = dict(createdAt=__import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
                  dataset="Wikimedia Commons + Open Images v5 licensed food images, expansion v2", fingerprint=selection["fingerprint"],
                  classes=len(labels), counts=split["counts"], totalEligible=len(split["rows"]), excluded=len(split["excluded"]),
                  collection=split.get("collection"), testedLabels=split.get("testedLabels"), unmeasuredLabels=split.get("unmeasuredLabels"),
                  selection=selection, test=scores(combined,truth,labels), testSubgroups=subgroups, referenceModels=individual,
                  experimental=True, productionEnabled=False,
                  limitations=["Commons weak category labels and Open Images bounding-box annotations; no complete local manual review", "v1 test retired; scores are not directly comparable to the old 22-class benchmark",
                               "Legacy categories without fresh holdout remain train-only; no v2 accuracy claim for them; macro-F1 averages only labels with test support",
                               "Near-duplicate groups isolated; photographer/session leakage may remain", "ImageNet pretraining overlap cannot be ruled out",
                               "Open Images source crops are easier than unlocalized full meal photographs; cross-source domain shift is not measured",
                               "Closed-set single-dish categories; no independent real-user-photo or unknown-food benchmark",
                               "Softmax scores are uncalibrated; no ground-truth portion weight or nutrition", "No comparison against production vision provider on this holdout"])
    atomic_json(report_path, report)
    print(json.dumps(dict(stage="final-test", classes=len(labels), test=compact(report["test"]), productionEnabled=False)), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage", choices=["prepare","train","evaluate"])
    parser.add_argument("--run", default="v2")
    parser.add_argument("--epochs", type=int, default=25)
    parser.add_argument("--patience", type=int, default=7)
    parser.add_argument("--batch-size", type=int, default=24)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--seed", type=int, default=20261113)
    parser.add_argument("--architectures", nargs="+", choices=list(ARCHITECTURES), default=list(ARCHITECTURES))
    args = parser.parse_args()
    if not args.run.replace("-", "").replace("_", "").isalnum():
        parser.error("run must be a simple directory name")
    torch.set_num_threads(4)
    torch.manual_seed(args.seed)
    torch.backends.cudnn.benchmark = False
    torch.backends.cudnn.deterministic = True
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if args.stage == "prepare":
        for architecture in args.architectures:
            model = make_model(architecture, 70, pretrained=True).to(device)
            with torch.inference_mode():
                model.eval()(torch.zeros(1,3,224,224,device=device))
            print(json.dumps(dict(prepared=architecture, device=str(device))), flush=True)
        return
    run = DATA / args.run
    run.mkdir(parents=True, exist_ok=True)
    split = json.loads((DATA / "split-v2.json").read_text(encoding="utf-8"))
    labels = validate_partition(split)
    verify_images(split["rows"])
    if len(labels) < 2:
        raise ValueError("Need at least two eligible food classes")
    if args.stage == "train": train(args,run,split,labels,device)
    else: evaluate(args,run,split,labels,device)


if __name__ == "__main__":
    main()
