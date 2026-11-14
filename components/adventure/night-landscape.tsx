import { ExplorerDrawing } from "./explorer-avatar";
export function NightLandscape({ reward = "moon-scout", small = false }: { reward?: string; small?: boolean }) {
  return <svg className={`night-landscape ${small ? "small" : ""}`} viewBox="0 0 600 260" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
    <path fill="#19203f" d="M0 0h600v260H0z" />
    <circle cx="421" cy="79" r="43" fill="#ccebf0" /><circle cx="408" cy="68" r="8" fill="#b7dce7" /><circle cx="437" cy="90" r="12" fill="#b7dce7" />
    {[[38,36],[137,57],[230,26],[309,68],[505,27],[560,104],[81,101],[350,19],[535,157],[189,88]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={i%3 ? 1.2 : 2} fill="#9dbcd2" />)}
    <path d="m257 49 34-12" stroke="#7bcce1" strokeWidth="2" strokeLinecap="round" />
    <path d="M0 164c83-43 128-17 205-26 104-13 127-5 209 22 62 20 123-38 186-21v121H0z" fill="#29345b" />
    <path d="M0 213c83-30 152-68 231-39 82 31 110 11 182-3 62-12 132 31 187 16v73H0z" fill="#222842" />
    <path d="M0 236c85-17 128-5 215-27 97-26 143-3 215 9 61 10 114-13 170-7v49H0z" fill="#11162b" />
    <path d="M312 260c-12-28-24-29-18-39 7-9 34-6 42-16" stroke="#485371" strokeWidth="7" />
    <path d="M485 219c-1-45 5-65 2-113m0 40-22-23m23 40 23-30m-24-4 13-16" stroke="#11162b" strokeWidth="6" strokeLinecap="round" />
    <path d="M466 123l-7-12m51 23 8-8" stroke="#11162b" strokeWidth="3" strokeLinecap="round" />
    <g transform="translate(135 0)"><path d="m383 223 19-40 29 40z" fill="#3d6481" /><path d="m402 183 5 40h-24z" fill="#699fb5" /><path d="m407 223 6-16 10 16" fill="#101728" /></g>
    <g className="night-explorer"><svg x="375" y="115" width="112" height="132" viewBox="0 0 240 280"><ExplorerDrawing reward={reward} /></svg></g>
  </svg>;
}
