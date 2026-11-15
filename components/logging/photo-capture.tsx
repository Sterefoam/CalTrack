"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useDashboardState } from "@/components/dashboard/dashboard-state";
import { PhotoAnalysis } from "./photo-analysis";

const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
const maxSize = 4 * 1024 * 1024;

export function PhotoCapture() {
  const { photoFile, setPhotoFile, mode } = useDashboardState();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!photoFile) { setPreview(""); return; }
    const url = URL.createObjectURL(photoFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  function choose(file?: File) {
    if (!file) return;
    setError("");
    if (!allowedTypes.includes(file.type)) { setError("Pilih foto JPG, PNG, atau WebP. Ubah foto HEIC ke JPG terlebih dahulu."); return; }
    if (file.size === 0 || file.size > maxSize) { setError("Ukuran foto harus lebih dari 0 dan maksimal 4 MB."); return; }
    setPhotoFile(file);
  }
  function fileChange(event: ChangeEvent<HTMLInputElement>) { choose(event.target.files?.[0]); event.target.value = ""; }
  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length > 1) { setError("Pilih satu foto hidangan dalam satu waktu."); return; }
    choose(event.dataTransfer.files[0]);
  }

  return <div className="photo-layout">
    <section className="surface-panel photo-selector" aria-labelledby="capture-title">
      <h2 id="capture-title">Tampilkan seluruh hidangan</h2>
      <p className="photo-description">Ambil dari atas atau sedikit menyamping, dengan cahaya yang cukup.</p>
      <div className={`photo-dropzone ${dragging ? "is-dragging" : ""}`} role="group" aria-label="Pratinjau dan area unggah foto makanan" aria-describedby="photo-file-help" onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
        {preview ? <img className="food-preview" src={preview} alt="Pratinjau foto makanan yang dipilih" onError={() => { setError("Foto tidak dapat dibuka. Pilih gambar lain yang valid."); setPhotoFile(null); }} /> : <div className="photo-empty"><svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="8" y="17" width="48" height="36" rx="6" /><path d="m20 17 5-7h14l5 7" /><circle cx="32" cy="35" r="11" /></svg><p>Foto hidanganmu akan muncul di sini.</p><span>Atau seret foto ke area ini.</span></div>}
      </div>
      <input ref={camera} type="file" accept={allowedTypes.join(",")} capture="environment" onChange={fileChange} className="sr-only" tabIndex={-1} aria-label="Ambil foto makanan dengan kamera" />
      <input ref={gallery} type="file" accept={allowedTypes.join(",")} onChange={fileChange} className="sr-only" tabIndex={-1} aria-label="Pilih foto makanan dari galeri" />
      <p id="photo-file-help" className="field-help photo-file-help">JPG, PNG, atau WebP, maksimal 4 MB. {mode === "demo" ? "Foto tetap di perangkat pada mode demo." : "Foto dikirim ke layanan AI saat analisis dimulai."}</p>
      <div className="photo-actions"><button type="button" className="ui-btn ui-btn-primary" aria-describedby="photo-file-help" onClick={() => camera.current?.click()}>Ambil foto</button><button type="button" className="ui-btn" aria-describedby="photo-file-help" onClick={() => gallery.current?.click()}>Pilih dari galeri</button></div>
      {error && <p className="ui-alert ui-alert-error mt-4" role="alert">{error}</p>}
      {photoFile && <div className="photo-selection"><span className="selected-file">{photoFile.name}</span><button type="button" className="ui-btn ui-btn-ghost" onClick={() => { setPhotoFile(null); setError(""); }}>Hapus foto</button></div>}
    </section>
    <aside className="surface-panel photo-guide"><h2>Foto yang mudah ditinjau</h2><ul><li>Satu piring atau satu hidangan dalam foto.</li><li>Hindari foto buram dan bayangan yang menutupi makanan.</li><li>Pastikan lauk, nasi, dan pelengkap terlihat jelas.</li></ul>{photoFile && <PhotoAnalysis file={photoFile} />}</aside>
  </div>;
}
