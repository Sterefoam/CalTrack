import Link from "next/link";
import { PhotoCapture } from "@/components/logging/photo-capture";
import { InputModePicker } from "@/components/logging/input-mode-picker";

export default function PhotoPage() {
  return <div className="content-wrap logging-page">
    <Link className="ui-btn ui-btn-ghost mb-6" href="/log">Kembali ke catatan makan</Link>
    <header className="page-heading"><h1>Foto makanan</h1><p>Catat hidangan dari kamera atau galeri.</p></header>
    <InputModePicker />
    <PhotoCapture />
  </div>;
}
