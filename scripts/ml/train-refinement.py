"""Refine v2 on extra licensed images; compare once on a fresh, quarantined v3 test."""
import argparse
import importlib.util
import json
from pathlib import Path
import random
import sys
import time

spec=importlib.util.spec_from_file_location("classification",Path(__file__).with_name("train-expanded.py"))
ml=importlib.util.module_from_spec(spec);sys.modules[spec.name]=ml;spec.loader.exec_module(ml)
torch,np,nn=ml.torch,ml.np,ml.nn


def validate(split,previous):
    old={row["id"]:row for row in previous["rows"]}
    if split["labels"]!=sorted(previous["counts"]):raise ValueError("Frozen class vocabulary changed")
    ids,groups,hashes,sources=set(),{},{},{}
    for row in split["rows"]:
        if row["id"] in ids or row["label"] not in split["labels"] or row["split"] not in ("train","validation","test"):raise ValueError("Invalid refinement row")
        ids.add(row["id"])
        if row["id"] in old and old[row["id"]]["split"]!=row["split"]:raise ValueError("Old data partition moved")
        if row["split"]=="test" and (row["id"] in old or not row["fresh"]):raise ValueError("Final test must be fresh")
        for mapping,key in ((groups,row["groupId"]),(hashes,row["sha256"]),(sources,row.get("sourceImageId")),(sources,row.get("sourceImageSha256"))):
            if key and key in mapping and mapping[key]!=row["split"]:raise ValueError("Refinement leakage")
            if key:mapping[key]=row["split"]
        if ml.DATA.resolve() not in (ml.DATA/row["file"]).resolve().parents:raise ValueError("Invalid image path")
    if any(not any(row["label"]==label and row["split"]=="train" for row in split["rows"]) for label in split["labels"]):raise ValueError("Missing training class")


def transform(augment=False):
    operations=[ml.transforms.RandomResizedCrop(256,scale=(.8,1.),interpolation=ml.InterpolationMode.BICUBIC),
                ml.transforms.RandomHorizontalFlip(),ml.transforms.ColorJitter(brightness=.1,contrast=.1,saturation=.1)] if augment else [
                    ml.transforms.Resize(288,interpolation=ml.InterpolationMode.BICUBIC),ml.transforms.CenterCrop(256)]
    return ml.transforms.Compose(operations+[ml.transforms.ToTensor(),ml.transforms.Normalize([.485,.456,.406],[.229,.224,.225])])


def probability(model,rows,labels,args,device,preprocess):
    logits,truth=ml.predict_logits(model,ml.make_loader(rows,labels,preprocess,args),device,tta=True)
    return logits.softmax(1).numpy(),truth


def baseline(rows,labels,args,device):
    selection=json.loads((ml.DATA/"v2/selection.json").read_text(encoding="utf-8"))
    if selection["labels"]!=labels:raise ValueError("Baseline class order changed")
    combined=None
    for weight,candidate in zip(selection["selected"]["weights"],selection["candidates"]):
        if weight==0:continue
        model,saved=ml.checkpoint_model(ml.DATA/"v2"/candidate["checkpoint"],device)
        loader=ml.make_loader(rows,labels,ml.ARCHITECTURES[saved["architecture"]][1].transforms(),args)
        logits,truth=ml.predict_logits(model,loader,device,tta=True)
        part=(logits/selection["selected"]["temperature"]).softmax(1).numpy()
        combined=weight*part if combined is None else combined+weight*part
        del model
    return combined,truth


def train_network(architecture,training,validation,labels,args,run,device,digest):
    destination,finished=run/f"{architecture}-best.pt",run/f"{architecture}-finished.json"
    if finished.exists():
        if json.loads(finished.read_text())["fingerprint"]!=digest:raise ValueError("Different dataset in run")
        return destination
    torch.manual_seed(args.seed);random.seed(args.seed);np.random.seed(args.seed)
    model,saved=ml.load_checkpoint(ml.DATA/"v2"/f"{architecture}-best.pt",device)
    if saved["labels"]!=labels:raise ValueError("Initial checkpoint has different vocabulary")
    optimizer=torch.optim.AdamW([dict(params=model.features.parameters(),lr=1e-5),dict(params=model.classifier.parameters(),lr=1e-4)],weight_decay=.02)
    scheduler=torch.optim.lr_scheduler.CosineAnnealingLR(optimizer,args.epochs,eta_min=1e-6)
    scaler=torch.amp.GradScaler("cuda",enabled=device.type=="cuda")
    counts=torch.tensor([sum(row["label"]==label for row in training) for label in labels],device=device,dtype=torch.float32)
    weights=(counts.sum()/counts).sqrt();weights/=weights.mean()
    criterion=nn.CrossEntropyLoss(weight=weights,label_smoothing=.05)
    loader=ml.make_loader(training,labels,transform(True),args,shuffle=True)
    best,stale,history=(-1.,-1.),0,[]
    for epoch in range(args.epochs):
        started=time.monotonic();model.train();loss_sum=0
        for step,(inputs,target) in enumerate(loader):
            inputs,target=inputs.to(device),target.to(device);optimizer.zero_grad(set_to_none=True)
            with torch.autocast(device_type=device.type,enabled=device.type=="cuda"):loss=criterion(model(inputs),target)
            scaler.scale(loss).backward();scaler.unscale_(optimizer);nn.utils.clip_grad_norm_(model.parameters(),1.)
            scaler.step(optimizer);scaler.update();loss_sum+=loss.item()*len(target)
            if (step+1)%100==0:print(json.dumps(dict(stage="v3-training",architecture=architecture,epoch=epoch+1,batch=step+1,batches=len(loader))),flush=True)
        scheduler.step();probabilities,truth=probability(model,validation,labels,args,device,transform())
        result=ml.scores(probabilities,truth,labels);key=(result["top1"],result["macroF1"])
        record=dict(epoch=epoch+1,loss=loss_sum/len(training),validation=ml.compact(result),seconds=round(time.monotonic()-started,2));history.append(record)
        print(json.dumps(dict(stage="v3-epoch",architecture=architecture,**record)),flush=True)
        if key>best:
            best,stale=key,0
            ml.atomic_torch(destination,dict(state=model.state_dict(),architecture=architecture,labels=labels,kind="refined-v3",fingerprint=digest,epoch=epoch+1))
        else:stale+=1
        ml.atomic_json(run/f"{architecture}-history.json",history)
        if epoch>=3 and stale>=args.patience:break
    ml.atomic_json(finished,dict(fingerprint=digest,bestValidationTop1=best[0],epochs=len(history)))
    del model,optimizer
    if device.type=="cuda":torch.cuda.empty_cache()
    return destination


def train(split,args,run,device):
    if (run/"report.json").exists():raise ValueError("Fresh test already sealed; stop tuning")
    labels=split["labels"];digest=ml.fingerprint(split["rows"])
    training=[row for row in split["rows"] if row["split"]=="train"]
    validation=[row for row in split["rows"] if row["split"]=="validation"]
    ml.atomic_json(run/"dataset.json",split)
    probabilities,truth=baseline(validation,labels,args,device)
    candidates=[dict(kind="frozen-v2-ensemble",checkpoint=None,validation=ml.compact(ml.scores(probabilities,truth,labels)))]
    outputs=[probabilities]
    print(json.dumps(dict(stage="v3-baseline-validation",validation=candidates[0]["validation"])),flush=True)
    for architecture in ("efficientnet_b0","convnext_tiny"):
        path=train_network(architecture,training,validation,labels,args,run,device,digest)
        model,saved=ml.load_checkpoint(path,device)
        probabilities,_=probability(model,validation,labels,args,device,transform());outputs.append(probabilities)
        candidates.append(dict(kind="refined-v3",checkpoint=path.name,architecture=architecture,validation=ml.compact(ml.scores(probabilities,truth,labels))))
        del model
    best=None
    for a in range(5):
        for b in range(5-a):
            weights=[a/4,b/4,(4-a-b)/4]
            combined=sum(weight*output for weight,output in zip(weights,outputs));result=ml.scores(combined,truth,labels)
            key=(result["top1"],result["macroF1"])
            if best is None or key>best[0]:best=(key,dict(weights=weights,validation=ml.compact(result)))
    selection=dict(fingerprint=digest,labels=labels,candidates=candidates,selected=best[1],seed=args.seed,epochsLimit=args.epochs,
                   selectionMetric="validation top1, then supported-class macroF1",testAccessed=False,inputResolution=256,
                   previousTestPolicy="v2 final test entirely quarantined; v3 final test contains fresh source photos only",
                   torch=torch.__version__,gpu=torch.cuda.get_device_name() if device.type=="cuda" else None)
    ml.atomic_json(run/"selection.json",selection)
    print(json.dumps(dict(stage="v3-selection",**selection)),flush=True)


def evaluate(split,args,run,device):
    if (run/"report.json").exists():raise ValueError("Fresh v3 test report sealed")
    selection=json.loads((run/"selection.json").read_text(encoding="utf-8"))
    if selection["fingerprint"]!=ml.fingerprint(split["rows"]):raise ValueError("Dataset changed after selection")
    labels=split["labels"];test=[row for row in split["rows"] if row["split"]=="test"]
    old,truth=baseline(test,labels,args,device);outputs=[old]
    for weight,candidate in zip(selection["selected"]["weights"][1:],selection["candidates"][1:]):
        if weight:
            model,_=ml.load_checkpoint(run/candidate["checkpoint"],device)
            probabilities,_=probability(model,test,labels,args,device,transform());del model
        else:probabilities=np.zeros_like(old)
        outputs.append(probabilities)
    combined=sum(weight*output for weight,output in zip(selection["selected"]["weights"],outputs))
    predicted,reference=combined.argmax(1),old.argmax(1)
    discordant=dict(improvedOnly=int(np.sum((predicted==truth)&(reference!=truth))),regressedOnly=int(np.sum((predicted!=truth)&(reference==truth))))
    report=dict(createdAt=__import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
                protocol=split["protocol"],classes=len(labels),testedLabels=split["testedLabels"],unmeasuredLabels=split["unmeasuredLabels"],
                counts={part:sum(row["split"]==part for row in split["rows"]) for part in ("train","validation","test")},
                selection=selection,test=ml.scores(combined,truth,labels),frozenV2OnSameFreshTest=ml.scores(old,truth,labels),pairedDisagreements=discordant,
                experimental=True,productionEnabled=False,limitations=[
                    "Fresh test measures only categories with enough additional licensed Open Images photographs, not every trained category",
                    "Do not compare headline accuracy directly with the older, differently composed v2 test",
                    "One representative per duplicate group; photographer/session and pretraining overlap may remain",
                    "No mobile-user-photo, unknown-food, grams, nutrition or production vision-provider accuracy claim",
                    "No universal maximum accuracy claim; final test is sealed against later tuning"])
    ml.atomic_json(run/"report.json",report)
    print(json.dumps(dict(stage="v3-final-test",test=ml.compact(report["test"]),baseline=ml.compact(report["frozenV2OnSameFreshTest"]),paired=discordant)),flush=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument("stage",choices=["train","evaluate"])
    parser.add_argument("--run",default="v3");parser.add_argument("--epochs",type=int,default=12);parser.add_argument("--patience",type=int,default=4)
    parser.add_argument("--batch-size",type=int,default=12);parser.add_argument("--workers",type=int,default=2);parser.add_argument("--seed",type=int,default=20261114)
    args=parser.parse_args()
    if not args.run.replace("-","").replace("_","").isalnum():parser.error("Invalid run name")
    torch.set_num_threads(4);torch.manual_seed(args.seed);torch.backends.cudnn.deterministic=True;torch.backends.cudnn.benchmark=False
    split=json.loads((ml.DATA/"split-v3.json").read_text(encoding="utf-8"));previous=json.loads((ml.DATA/"split-v2.json").read_text(encoding="utf-8"))
    validate(split,previous);ml.verify_images(split["rows"])
    run=ml.DATA/args.run;run.mkdir(exist_ok=True);device=torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if args.stage=="train":train(split,args,run,device)
    else:evaluate(split,args,run,device)


if __name__=="__main__":main()
