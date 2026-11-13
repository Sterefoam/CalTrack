import Link from "next/link";
import { NutritionLabelCapture } from "@/components/logging/nutrition-label";

export default function LabelPage() {
  return <div className="content-wrap logging-page">
    <Link className="ui-btn ui-btn-ghost mb-6" href="/log">Kembali ke catatan makan</Link>
    <header className="page-heading"><h1>Baca tabel nutrisi</h1><p>Foto tabel pada kemasan, periksa hasilnya, lalu sesuaikan jumlah yang dimakan.</p></header>
    <NutritionLabelCapture />
  </div>;
}
