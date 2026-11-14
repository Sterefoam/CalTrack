import { QuestBoard } from "@/components/adventure/quest-board";
import { AvatarWardrobe } from "@/components/adventure/avatar-wardrobe";
export default function QuestsPage() {
  return <div className="content-wrap"><header className="page-heading"><h1>Perjalanan & hadiah</h1><p>Kebiasaan kecil, cerita baru untuk penjelajahmu.</p></header>
    <AvatarWardrobe /><QuestBoard />
    <p className="chat-footnote">XP diberikan untuk mencatat, bukan jumlah kalori atau banyaknya makanan yang dimakan. XP yang sudah diambil tetap menjadi milikmu. Hadiah tersimpan di akun.</p></div>;
}
