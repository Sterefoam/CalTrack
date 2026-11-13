import { InputModePicker } from "@/components/logging/input-mode-picker";
import { BarcodeScanner } from "@/components/logging/barcode-scanner";

export default function BarcodePage() {
  return <div className="content-wrap logging-page"><header className="page-heading"><h1>Barcode makanan</h1><p>Temukan informasi gizi makanan kemasan lewat kode pada labelnya.</p></header><InputModePicker /><BarcodeScanner /></div>;
}
