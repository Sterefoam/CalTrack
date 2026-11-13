"""Research-only food mass regression using weighed Nutrition5k overhead RGB images."""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import random
import time

spec=importlib.util.spec_from_file_location("food_training",Path(__file__).with_name("train-expanded.py"))
ml=importlib.util.module_from_spec(spec);spec.loader.exec_module(ml)
torch,np,nn=ml.torch,ml.np,ml.nn
DATA=ml.DATA/"portion"


def prepare_split(source):
    rows=[dict(row) for row in source["rows"]]
    days=sorted({row["day"] for row in rows if row["split"]=="validation"},key=lambda day:hashlib.sha256(("mass-calibration:"+day).encode()).hexdigest())
    if len(days)<3:raise ValueError("Need separate validation and calibration capture days")
    calibration=set(days[:max(1,len(days)//3)])
    for row in rows:
        if row["split"]=="validation" and row["day"] in calibration:row["split"]="calibration"
    source=dict(source,rows=rows,counts={part:sum(row["split"]==part for row in rows) for part in ("train","validation","calibration","test")})
    validate_split(source)
    return source


def validate_split(split):
    ids,hashes,groups,days=set(),{},{},{}
    for row in split["rows"]:
        if row["id"] in ids or row["split"] not in ("train","validation","calibration","test") or not math.isfinite(row["grams"]) or row["grams"]<=0:
            raise ValueError("Invalid mass annotation or partition")
        ids.add(row["id"])
        if (row["split"]=="test")!=(row["officialSplit"]=="test"):raise ValueError("Official test partition changed")
        for mapping,key in ((hashes,row["sha256"]),(groups,row["groupId"])):
            if key in mapping and mapping[key]!=row["split"]:raise ValueError("Food mass dataset leakage")
            mapping[key]=row["split"]
        if row["officialSplit"]=="train":
            if row["day"] in days and days[row["day"]]!=row["split"]:raise ValueError("Capture day leakage")
            days[row["day"]]=row["split"]
        path=(ml.DATA/row["file"]).resolve()
        if DATA.resolve() not in path.parents:raise ValueError("Image outside mass dataset")
    if any(sum(row["split"]==part for row in split["rows"])<20 for part in ("train","validation","calibration","test")):
        raise ValueError("Each partition needs at least 20 weighed dishes")


def fingerprint(rows):
    payload=[{key:row[key] for key in ("id","sha256","grams","split","groupId")} for row in sorted(rows,key=lambda row:row["id"])]
    return hashlib.sha256(json.dumps(payload,sort_keys=True).encode()).hexdigest()


def metrics(prediction,truth):
    prediction,truth=np.asarray(prediction),np.asarray(truth)
    error=np.abs(prediction-truth)
    return dict(samples=len(truth),maeGrams=float(error.mean()),medianAbsoluteErrorGrams=float(np.median(error)),
                rmseGrams=float(np.sqrt(np.mean((prediction-truth)**2))),mape=float(np.mean(error/truth)),
                within20Percent=float(np.mean(error<=truth*.2)),within50Grams=float(np.mean(error<=50)))


def conformal_radius(prediction,truth,coverage=.9):
    residual=np.sort(np.abs(np.asarray(prediction)-np.asarray(truth)))
    if len(residual)<20:raise ValueError("Insufficient independent calibration support")
    return float(residual[min(len(residual),math.ceil((len(residual)+1)*coverage))-1])


def preprocess(augment=False):
    # Preserve the full plate: random crops would change visible food without changing grams.
    parts=[ml.transforms.Resize((224,224),interpolation=ml.InterpolationMode.BICUBIC)]
    if augment:parts.extend([ml.transforms.RandomHorizontalFlip(),ml.transforms.ColorJitter(brightness=.08,contrast=.08,saturation=.08)])
    return ml.transforms.Compose(parts+[ml.transforms.ToTensor(),ml.transforms.Normalize([.485,.456,.406],[.229,.224,.225])])


class MassImages(ml.Dataset):
    def __init__(self,rows,augment=False):self.rows,self.transform=rows,preprocess(augment)
    def __len__(self):return len(self.rows)
    def __getitem__(self,index):
        row=self.rows[index]
        with ml.Image.open(ml.DATA/row["file"]) as image:pixels=self.transform(image.convert("RGB"))
        return pixels,torch.tensor(row["grams"],dtype=torch.float32)


def loader(rows,args,augment=False):
    return ml.DataLoader(MassImages(rows,augment),batch_size=args.batch_size,shuffle=augment,num_workers=args.workers,
                         pin_memory=torch.cuda.is_available(),persistent_workers=args.workers>0,
                         generator=torch.Generator().manual_seed(args.seed))


class MassModel(nn.Module):
    def __init__(self,pretrained=False,normalized=False):
        super().__init__()
        base=ml.models.efficientnet_b0(weights=ml.models.EfficientNet_B0_Weights.IMAGENET1K_V1 if pretrained else None)
        self.features,self.avgpool=base.features,base.avgpool
        self.head=nn.Linear(1280,1)
        self.normalized=normalized
        self.register_buffer("mean",torch.zeros(1280));self.register_buffer("scale",torch.ones(1280))
    def encode(self,x):return self.avgpool(self.features(x)).flatten(1)
    def forward(self,x):
        features=self.encode(x)
        if self.normalized:features=(nn.functional.normalize(features,dim=1)-self.mean)/self.scale
        return self.head(features).squeeze(1)


def grams(log_mass):return torch.expm1(log_mass.float().clamp(min=0,max=math.log1p(10000))).clamp(min=.1)


def predict(model,rows,args,device):
    model.eval();predictions=[]
    with torch.inference_mode():
        for x,_ in loader(rows,args):
            x=x.to(device)
            with torch.autocast(device_type=device.type,enabled=device.type=="cuda"):
                log_mass=(model(x)+model(x.flip(-1)))/2
            predictions.append(grams(log_mass).cpu().numpy())
    return np.concatenate(predictions)


def load_model(path,device):
    saved=torch.load(path,map_location="cpu",weights_only=True)
    model=MassModel(normalized=saved["normalized"]);model.load_state_dict(saved["state"])
    return model.to(device),saved


def save_model(path,model,kind,digest,**extra):
    ml.atomic_torch(path,dict(state=model.state_dict(),normalized=model.normalized,kind=kind,fingerprint=digest,**extra))


def train_probe(training,validation,args,run,device,digest):
    destination=run/"ridge-best.pt"
    if destination.exists():
        if torch.load(destination,map_location="cpu",weights_only=True)["fingerprint"]!=digest:raise ValueError("Different mass dataset in run")
        return destination
    model=MassModel(pretrained=True,normalized=True).to(device).eval()
    features=[]
    with torch.inference_mode():
        for rows in (training,validation):
            encoded=[]
            for x,_ in loader(rows,args):encoded.append(model.encode(x.to(device)).float())
            features.append(nn.functional.normalize(torch.cat(encoded),dim=1))
    x,vx=features;mean=x.mean(0);scale=x.std(0).clamp(min=1e-4)
    x=(x-mean)/scale;vx=(vx-mean)/scale
    model.mean.copy_(mean);model.scale.copy_(scale)
    x=torch.cat([x,torch.ones(len(x),1,device=device)],1).double()
    vx=torch.cat([vx,torch.ones(len(vx),1,device=device)],1).double()
    target=torch.log1p(torch.tensor([row["grams"] for row in training],device=device,dtype=torch.float64))
    truth=np.array([row["grams"] for row in validation]);best=float("inf")
    covariance=x.T@x;rhs=x.T@target
    for regularization in (.1,1.,10.,100.,1000.):
        penalty=torch.eye(x.shape[1],device=device,dtype=torch.float64)*regularization;penalty[-1,-1]=0
        beta=torch.linalg.solve(covariance+penalty,rhs)
        result=metrics(grams(vx@beta).cpu().numpy(),truth)
        print(json.dumps(dict(stage="mass-ridge",regularization=regularization,validation=result)),flush=True)
        if result["maeGrams"]<best:
            best=result["maeGrams"]
            model.head.weight.data.copy_(beta[:-1].float().unsqueeze(0));model.head.bias.data.copy_(beta[-1:].float())
            save_model(destination,model,"frozen-ridge-log-mass",digest,regularization=regularization)
    return destination


def train_network(training,validation,args,run,device,digest):
    destination,finished=run/"finetuned-best.pt",run/"finetuned-finished.json"
    if finished.exists():
        if json.loads(finished.read_text())["fingerprint"]!=digest:raise ValueError("Different mass dataset")
        return destination
    torch.manual_seed(args.seed);random.seed(args.seed);np.random.seed(args.seed)
    model=MassModel(pretrained=True).to(device)
    nn.init.zeros_(model.head.weight);nn.init.constant_(model.head.bias,math.log1p(np.median([row["grams"] for row in training])))
    optimizer=torch.optim.AdamW([dict(params=model.features.parameters(),lr=3e-5),dict(params=model.head.parameters(),lr=5e-4)],weight_decay=.01)
    scheduler=torch.optim.lr_scheduler.CosineAnnealingLR(optimizer,args.epochs,eta_min=2e-6)
    scaler=torch.amp.GradScaler("cuda",enabled=device.type=="cuda")
    train_loader=loader(training,args,True);truth=np.array([row["grams"] for row in validation])
    best,stale,history=float("inf"),0,[]
    for epoch in range(args.epochs):
        start=time.monotonic();model.train()
        for parameter in model.features.parameters():parameter.requires_grad=epoch>=2
        if epoch<2:model.features.eval()
        loss_sum=0.
        for x,y in train_loader:
            x,y=x.to(device),y.to(device);optimizer.zero_grad(set_to_none=True)
            with torch.autocast(device_type=device.type,enabled=device.type=="cuda"):
                output=model(x)
                loss=nn.functional.smooth_l1_loss(output,torch.log1p(y),beta=.1)+.1*nn.functional.l1_loss(grams(output),y)/300
            scaler.scale(loss).backward();scaler.unscale_(optimizer);nn.utils.clip_grad_norm_(model.parameters(),1.)
            scaler.step(optimizer);scaler.update();loss_sum+=loss.item()*len(y)
        scheduler.step();result=metrics(predict(model,validation,args,device),truth)
        record=dict(epoch=epoch+1,loss=loss_sum/len(training),validation=result,seconds=round(time.monotonic()-start,2));history.append(record)
        print(json.dumps(dict(stage="mass-finetuning",**record)),flush=True)
        if result["maeGrams"]<best:
            best,stale=result["maeGrams"],0;save_model(destination,model,"finetuned-log-mass",digest,epoch=epoch+1)
        else:stale+=1
        ml.atomic_json(run/"history.json",history)
        if epoch>=9 and stale>=args.patience:break
    ml.atomic_json(finished,dict(fingerprint=digest,epochs=len(history),bestValidationMaeGrams=best))
    return destination


def train(split,args,run,device):
    if (run/"report.json").exists():raise ValueError("Mass test report sealed; do not tune on this test")
    digest=fingerprint(split["rows"])
    ml.atomic_json(run/"dataset.json",split)
    training=[row for row in split["rows"] if row["split"]=="train"]
    validation=[row for row in split["rows"] if row["split"]=="validation"]
    calibration=[row for row in split["rows"] if row["split"]=="calibration"]
    truth=np.array([row["grams"] for row in validation]);median=float(np.median([row["grams"] for row in training]))
    candidates=[dict(kind="training-median",checkpoint=None,medianGrams=median,validation=metrics(np.full(len(truth),median),truth))]
    for path in (train_probe(training,validation,args,run,device,digest),train_network(training,validation,args,run,device,digest)):
        model,saved=load_model(path,device)
        candidates.append(dict(kind=saved["kind"],checkpoint=path.name,validation=metrics(predict(model,validation,args,device),truth)))
        del model
    selected=min(candidates,key=lambda candidate:candidate["validation"]["maeGrams"])
    if selected["checkpoint"]:
        model,_=load_model(run/selected["checkpoint"],device);predictions=predict(model,calibration,args,device)
    else:predictions=np.full(len(calibration),median)
    radius=conformal_radius(predictions,np.array([row["grams"] for row in calibration]))
    selection=dict(fingerprint=digest,candidates=candidates,selected=selected,seed=args.seed,testAccessed=False,
                   interval=dict(method="split-conformal absolute gram residuals on separate capture-day calibration",targetCoverage=.9,radiusGrams=radius,samples=len(calibration)),
                   torch=torch.__version__,gpu=torch.cuda.get_device_name() if device.type=="cuda" else None,
                   protocol=split["protocol"],selectionMetric="validation mean absolute error in grams")
    ml.atomic_json(run/"selection.json",selection)
    print(json.dumps(dict(stage="mass-selection",selected=selected,interval=selection["interval"],testAccessed=False)),flush=True)


def evaluate(split,args,run,device):
    if (run/"report.json").exists():raise ValueError("Mass test report already sealed")
    selection=json.loads((run/"selection.json").read_text(encoding="utf-8"))
    if selection["fingerprint"]!=fingerprint(split["rows"]):raise ValueError("Mass dataset changed")
    test=[row for row in split["rows"] if row["split"]=="test"];truth=np.array([row["grams"] for row in test])
    selected=selection["selected"]
    if selected["checkpoint"]:
        model,_=load_model(run/selected["checkpoint"],device);prediction=predict(model,test,args,device)
    else:prediction=np.full(len(test),selected["medianGrams"])
    radius=selection["interval"]["radiusGrams"];lower=np.maximum(.1,prediction-radius);upper=prediction+radius
    median=selection["candidates"][0]["medianGrams"]
    report=dict(createdAt=__import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
                dataset="Nutrition5k overhead RGB, weighed total edible dish mass",license=split["license"],counts=split["counts"],excluded=len(split["excluded"]),
                selection=selection,test=metrics(prediction,truth),trainingMedianTest=metrics(np.full(len(truth),median),truth),
                intervalTest=dict(targetCoverage=.9,empiricalCoverage=float(np.mean((truth>=lower)&(truth<=upper))),meanWidthGrams=float(np.mean(upper-lower))),
                experimental=True,productionEnabled=False,limitations=split["limitations"]+[
                    "Grams regression, not food classification accuracy; no promise of exact weight from a single photo",
                    "Capture-day validation/calibration differ from original paper protocol; not directly comparable to published full-video/depth results",
                    "Conformal coverage depends on exchangeability; mobile camera/plate scale, cuisine and session shifts can invalidate intervals",
                    "No ground-truth comparison against the reference-assisted application vision provider"])
    ml.atomic_json(run/"report.json",report)
    print(json.dumps(dict(stage="mass-final-test",test=report["test"],baseline=report["trainingMedianTest"],interval=report["intervalTest"])),flush=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage",choices=["train","evaluate"]);parser.add_argument("--run",default="mass-v1")
    parser.add_argument("--epochs",type=int,default=30);parser.add_argument("--patience",type=int,default=6)
    parser.add_argument("--batch-size",type=int,default=32);parser.add_argument("--workers",type=int,default=2);parser.add_argument("--seed",type=int,default=20261113)
    args=parser.parse_args()
    if not args.run.replace("-","").replace("_","").isalnum():parser.error("Invalid mass run")
    torch.set_num_threads(4);torch.manual_seed(args.seed);torch.backends.cudnn.deterministic=True
    split=prepare_split(json.loads((DATA/"split.json").read_text(encoding="utf-8")))
    ml.verify_images(split["rows"])
    run=DATA/args.run;run.mkdir(exist_ok=True)
    device=torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if args.stage=="train":train(split,args,run,device)
    else:evaluate(split,args,run,device)


if __name__=="__main__":main()
