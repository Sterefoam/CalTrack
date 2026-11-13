import { requireUser } from "@/lib/auth/request";
import { readMultipart } from "@/lib/http/multipart";
import { InputError } from "@/lib/http/json";
import { AnalysisError } from "@/lib/ai/food-analysis";
import { allowAnalysis } from "@/lib/ai/rate-limit";
import { analyzeNutritionLabel } from "@/lib/ai/nutrition-label";
import { NutritionLabelError } from "@/lib/nutrition/label";
import { isLabelLanguage } from "@/lib/nutrition/label-languages";
import { analyzeLocalLabel } from "@/lib/ai/local-label";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request) {
  const identity=await requireUser(request);if(identity instanceof Response)return identity;
  if(!allowAnalysis(identity.userId))return Response.json({error:"analysis_rate_limited"},{status:429,headers:{"Retry-After":"60"}});
  try {
    const form=await readMultipart(request),photo=form.get("photo");
    if(!(photo instanceof File)||form.getAll("photo").length!==1)throw new InputError("photo_required");
    const language=form.get("language");
    if(form.getAll("language").length>1||language!==null&&language!=="auto"&&!isLabelLanguage(language))throw new InputError("invalid_label_language");
    const result=isLabelLanguage(language)?await analyzeLocalLabel(photo,language,request.signal):await analyzeNutritionLabel(photo,request.signal);
    return Response.json(result,{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    const known=error instanceof InputError||error instanceof AnalysisError||error instanceof NutritionLabelError;
    return Response.json({error:known?error.code:"label_unavailable"},{status:known?error.status:500});
  }
}
