"use client";

import { useEffect, useRef, useState } from "react";
import { analysisSteps, runDemoPhotoAnalysis } from "@/lib/demo/photo-analysis";
import Link from "next/link";
import { useDashboardState } from "@/components/dashboard/dashboard-state";
import { createFoodDraft } from "@/lib/logging/food-draft";
import { examplePhotoItems } from "@/lib/demo/photo-result";
import { api, type AnalysisResponse } from "@/lib/client/api";

type Status = "idle" | "analyzing" | "complete" | "error";

export function PhotoAnalysis({ file }: { file: File }) {
  const { setFoodDraft, mode } = useDashboardState();
  const [status, setStatus] = useState<Status>("idle");
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [referenceKind,setReferenceKind] = useState<"plate_diameter_cm"|"known_total_grams">("plate_diameter_cm");
  const [referenceValue,setReferenceValue] = useState("");
  const referenceNumber = Number(referenceValue);
  const validReference = referenceValue !== "" && Number.isFinite(referenceNumber) && (referenceKind === "plate_diameter_cm" ? referenceNumber >= 10 && referenceNumber <= 60 : referenceNumber >= 0.1 && referenceNumber <= 10000);
  const controller = useRef<AbortController | null>(null);
  const activeFile = useRef(file);
  activeFile.current = file;
  useEffect(() => {
    setStatus("idle");
    return () => controller.current?.abort();
  }, [file]);

  async function start() {
    if (mode === "account" && !validReference) { setError("Lengkapi ukuran pembanding terlebih dahulu."); return; }
    controller.current?.abort();
    const run = new AbortController();
    controller.current = run;
    setError("");
    setStatus("analyzing");
    setStep(0);
    try {
      let draft;
      if (mode === "account") {
        const body = new FormData(); body.set("photo", file);
        body.set("reference",JSON.stringify({kind:referenceKind,value:referenceNumber}));
        const result = await api<AnalysisResponse>("/api/analyze/photo", { method: "POST", body, signal: run.signal });
        draft = { ...createFoodDraft("photo", result.items, result.confidenceScore), origin: "analysis" as const,photoAssessment:result.photoAssessment };
      } else { await runDemoPhotoAnalysis(file, run.signal, setStep); draft = createFoodDraft("photo", examplePhotoItems, 0.88); }
      if (!run.signal.aborted && activeFile.current === file) {
        setFoodDraft(draft);
        setStatus("complete");
      }
    } catch (cause) {
      if (run.signal.aborted || activeFile.current !== file) return;
      setError(cause instanceof Error ? cause.message : "Analisis belum berhasil. Coba lagi.");
      setStatus("error");
    }
  }

  return <section className="analysis-panel" aria-label="Analisis foto">
    {status === "complete" && <Link className="ui-btn ui-btn-primary w-full mb-4" href="/log/review">{mode === "account" ? "Tinjau hasil AI" : "Tinjau hasil contoh"}</Link>}
    <h2>{mode === "account" ? "Analisis foto" : "Simulasi analisis"}</h2>
    <p className="photo-description">{mode === "account" ? "Saat analisis dimulai, foto dikirim ke server dan layanan AI untuk memperkirakan jenis makanan serta gizinya." : "Mode demo memperagakan proses analisis. Foto tidak dikirim ke layanan AI."}</p>
    {mode === "account" && <fieldset className="form-stack my-4" disabled={status === "analyzing"}>
      <legend className="font-semibold mb-2">Ukuran pembanding</legend>
      <label className="field-label" htmlFor="photo-reference-kind">Jenis acuan<select id="photo-reference-kind" className="ui-select w-full" value={referenceKind} onChange={event=>{setReferenceKind(event.target.value as typeof referenceKind);setReferenceValue("");setStatus("idle");}}><option value="plate_diameter_cm">Diameter piring (cm)</option><option value="known_total_grams">Berat seluruh makanan (g)</option></select></label>
      <label className="field-label" htmlFor="photo-reference-value">{referenceKind === "plate_diameter_cm" ? "Diameter piring, 10–60 cm" : "Berat seluruh makanan yang terlihat, 0,1–10.000 g"}<input id="photo-reference-value" className="ui-input w-full" type="number" inputMode="decimal" min={referenceKind === "plate_diameter_cm" ? 10 : 0.1} max={referenceKind === "plate_diameter_cm" ? 60 : 10000} step="0.1" value={referenceValue} onChange={event=>{setReferenceValue(event.target.value);setStatus("idle");}} aria-describedby="photo-reference-help" /></label>
      <p id="photo-reference-help" className="field-help">{referenceKind === "plate_diameter_cm" ? "Tampilkan seluruh tepi piring. Ketebalan dan kepadatan makanan masih diperkirakan, jadi gram belum setara hasil timbangan." : "Isi hasil timbangan atau berat kemasan jika seluruh isinya ada di foto dan akan dimakan. Jangan sertakan piring atau kemasannya."}</p>
    </fieldset>}
    {status === "analyzing" ? <><div className="analysis-progress" role="status"><span className="ui-loading ui-loading-spinner" aria-hidden="true" /><span>{mode === "account" ? "Menganalisis makanan..." : `${analysisSteps[step]}...`}</span></div>{mode === "demo" && <><progress className="ui-progress w-full" aria-label="Progres simulasi analisis" max={3} value={step + 1} /><ol className="analysis-step-list">{analysisSteps.map((label, index) => <li key={label} aria-current={index === step ? "step" : undefined}>{label}{index < step ? " · selesai" : ""}</li>)}</ol></>}<button className="ui-btn w-full" onClick={() => { controller.current?.abort(); setStatus("idle"); }}>Batalkan analisis</button></> : <><button className="ui-btn w-full" onClick={start}>{status === "idle" ? mode === "account" ? "Analisis foto" : "Coba analisis foto" : "Analisis ulang"}</button>{status === "complete" && <p className="ui-alert ui-alert-success mt-4" role="status">{mode === "account" ? "Analisis selesai. Tinjau estimasi sebelum dicatat." : "Simulasi selesai. Hasil contoh perlu ditinjau sebelum dicatat."}</p>}{status === "error" && <p className="ui-alert ui-alert-error mt-4" role="alert">{error}</p>}</>}
  </section>;
}
