"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDashboardState } from "@/components/dashboard/dashboard-state";
import { barcodePortion, demoBarcodeProduct } from "@/lib/demo/barcode-product";
import { createFoodDraft } from "@/lib/logging/food-draft";
import { NutritionSummary } from "./nutrition-summary";
import { formatNumber } from "@/lib/demo/nutrition-data";
import { FavoriteButton } from "./favorite-button";
import { AccountCatalog } from "./account-catalog";

export function BarcodeScanner() {
  const { mode } = useDashboardState();
  return mode === "account" ? <AccountCatalog barcode /> : <DemoBarcodeScanner />;
}

function DemoBarcodeScanner() {
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [found, setFound] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [barcodeError, setBarcodeError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [servings, setServings] = useState("1");
  const validServings = servings !== "" && Number(servings) >= 0.5 && Number(servings) <= 20 && Number(servings) % 0.5 === 0;
  const portion = validServings ? barcodePortion(Number(servings)) : null;
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  const { setFoodDraft } = useDashboardState();
  const router = useRouter();
  function release() { stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; if (video.current) video.current.srcObject = null; }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; release(); }; }, []);
  async function open() {
    setError(""); setFound(false);
    if (!navigator.mediaDevices?.getUserMedia) { setError("Kamera belum didukung browser ini. Kamu tetap bisa mencoba hasil contoh."); return; }
    setStarting(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      if (!mounted.current) { media.getTracks().forEach((track) => track.stop()); return; }
      stream.current = media;
      if (video.current) video.current.srcObject = media;
      setActive(true);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof DOMException && cause.name === "NotAllowedError" ? "Izin kamera belum diberikan. Izinkan kamera di browser atau coba hasil contoh." : "Kamera tidak dapat dibuka. Periksa perangkat atau coba hasil contoh.");
    } finally { if (mounted.current) setStarting(false); }
  }
  function example() { release(); setActive(false); setFound(true); setNotFound(false); setBarcodeError(""); setServings("1"); setError(""); }
  function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = barcode.replace(/[\s-]/g, "");
    if (!/^(?:\d{8}|\d{12,14})$/.test(normalized)) { setBarcodeError("Masukkan barcode berupa 8, 12, 13, atau 14 digit angka."); setFound(false); setNotFound(false); return; }
    setBarcodeError("");
    if (normalized === demoBarcodeProduct.barcode) example();
    else { release(); setActive(false); setFound(false); setNotFound(true); }
  }
  function manual() {
    release();
    setFoodDraft({ ...createFoodDraft("text", [{ foodName: "", weightGrams: 100, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 }]), origin: "manual" });
    router.push("/log/review");
  }

  return <section className="surface-panel barcode-panel"><h2>Kamera barcode</h2><p className="photo-description">Arahkan kamera ke barcode di kemasan. Pada mode demo, tombol hasil contoh menampilkan produk tiruan.</p>
    <div className={`barcode-preview${active ? " is-active" : ""}`}><video ref={video} autoPlay muted playsInline hidden={!active} aria-label="Pratinjau kamera barcode" />{!active && <p>{starting ? "Menunggu izin kamera..." : "Kamera belum aktif"}</p>}</div>
    <div className="text-log-actions">{active ? <button className="ui-btn" onClick={() => { release(); setActive(false); }}>Tutup kamera</button> : <button className="ui-btn ui-btn-primary" onClick={open} disabled={starting}>Buka kamera</button>}<button className="ui-btn" onClick={example} disabled={starting}>Gunakan hasil contoh</button></div>
    {error && <p className="ui-alert ui-alert-error mt-6" role="alert">{error}</p>}
    <form className="barcode-manual mt-6" onSubmit={lookup}><label className="field-label" htmlFor="barcode-number">Masukkan kode barcode<input id="barcode-number" className="ui-input w-full" inputMode="numeric" maxLength={32} required value={barcode} onChange={(e) => { setBarcode(e.target.value); setBarcodeError(""); }} aria-describedby="barcode-number-help" aria-invalid={!!barcodeError} /></label><p className="photo-description" id="barcode-number-help">Gunakan 8, 12, 13, atau 14 digit. Kode contoh: {demoBarcodeProduct.barcode}.</p>{barcodeError && <p className="ui-alert ui-alert-error mb-4" role="alert">{barcodeError}</p>}<button className="ui-btn" type="submit">Cari kode</button></form>
    {notFound && <div className="barcode-empty mt-6" role="status"><h2>Produk belum ditemukan</h2><p className="photo-description mt-4">Katalog demo hanya mengenali kode contoh. Periksa kembali kode atau isi gizi dari label kemasan.</p></div>}
    <div className="text-log-actions mt-6"><Link className="ui-btn ui-btn-ghost" href="/log/search">Cari nama makanan</Link><button className="ui-btn ui-btn-ghost" type="button" onClick={manual}>Isi gizi manual</button></div>
    {found && <section className="barcode-result mt-6"><h2>Hasil contoh</h2><p><strong>{demoBarcodeProduct.item.foodName}</strong></p><p>{demoBarcodeProduct.brand} · {demoBarcodeProduct.barcode}</p><p>180 kkal per sajian 40 gram</p><form className="mt-6" onSubmit={(event) => { event.preventDefault(); if (!portion) return; setFoodDraft(createFoodDraft("barcode", [portion])); router.push("/log/review"); }}><label className="field-label" htmlFor="barcode-servings">Jumlah sajian<input className="ui-input w-full" id="barcode-servings" type="number" required min={0.5} max={20} step={0.5} value={servings} onChange={(e) => setServings(e.target.value)} aria-describedby="barcode-serving-help" /></label><p id="barcode-serving-help">0,5–20 sajian. Satu sajian = 40 gram.</p>{portion ? <><p role="status">Porsi dipilih: {formatNumber(portion.weightGrams)} gram</p><NutritionSummary items={[portion]} /><FavoriteButton items={[portion]} inputMethod="barcode" /></> : <p role="status">Masukkan jumlah sajian yang valid.</p>}<button className="ui-btn ui-btn-primary mt-4" type="submit" disabled={!portion}>Tinjau gizi contoh</button></form></section>}
  </section>;
}
