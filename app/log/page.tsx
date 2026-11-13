import Link from "next/link";
import { Icon } from "@/components/layout/icon";
import { InputModePicker } from "@/components/logging/input-mode-picker";
import { ManualLogButton } from "@/components/logging/manual-log-button";

export default function LogPage() {
  return <div className="content-wrap logging-page">
    <header className="page-heading"><h1>Catat makananmu</h1><p>Pilih cara yang paling nyaman untuk mencatat asupan hari ini.</p></header>
    <InputModePicker />
    <section className="entry-panel" aria-labelledby="photo-title">
      <div><h2 id="photo-title">Mulai dari foto</h2><p>Foto satu piring makanan, lalu tinjau estimasi porsi dan gizinya sebelum disimpan.</p></div>
      <Link className="ui-btn ui-btn-primary" href="/log/photo">Catat lewat foto <Icon name="arrow" size={18} /></Link>
    </section>
    <section className="entry-panel mt-6" aria-labelledby="search-title">
      <div><h2 id="search-title">Cari di katalog</h2><p>Pilih makanan dari katalog dan sesuaikan porsinya.</p></div>
      <Link className="ui-btn" href="/log/search">Cari makanan <Icon name="arrow" size={18} /></Link>
    </section>
    <section className="entry-panel mt-6" aria-labelledby="text-title"><div><h2 id="text-title">Tulis yang kamu makan</h2><p>Ceritakan hidangan dan perkiraan porsi dengan kata-katamu sendiri.</p></div><Link className="ui-btn" href="/log/text">Catat lewat teks <Icon name="arrow" size={18} /></Link></section>
    <section className="entry-panel mt-6" aria-labelledby="voice-title"><div><h2 id="voice-title">Ceritakan lewat suara</h2><p>Rekam cerita singkat tentang makananmu dan putar ulang rekamannya.</p></div><Link className="ui-btn" href="/log/voice">Catat lewat suara <Icon name="arrow" size={18} /></Link></section>
    <section className="entry-panel mt-6" aria-labelledby="barcode-title"><div><h2 id="barcode-title">Makanan kemasan</h2><p>Mulai dari barcode produk atau cari nama makanan di katalog.</p></div><Link className="ui-btn" href="/log/barcode">Scan barcode <Icon name="arrow" size={18} /></Link></section>
    <section className="entry-panel mt-6" aria-labelledby="label-title"><div><h2 id="label-title">Tabel nutrisi pada kemasan</h2><p>Baca label berbagai bahasa, periksa angka aslinya, lalu hitung sesuai porsi.</p></div><Link className="ui-btn" href="/log/label">Baca tabel nutrisi <Icon name="arrow" size={18} /></Link></section>
    <section className="entry-panel mt-6" aria-labelledby="manual-title"><div><h2 id="manual-title">Isi gizi sendiri</h2><p>Gunakan label kemasan atau sumber gizi yang kamu ketahui. Semua nilai dapat ditinjau sebelum disimpan.</p></div><ManualLogButton /></section>
    <Link className="ui-btn ui-btn-ghost mt-6" href="/">Kembali ke dashboard</Link>
    <Link className="ui-btn ui-btn-ghost mt-6" href="/history">Lihat riwayat makan</Link>
    <Link className="ui-btn ui-btn-ghost mt-6" href="/recipes">Ide resep harian</Link>
  </div>;
}
