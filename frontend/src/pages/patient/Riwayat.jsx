import { useState, useEffect, useCallback } from "react";
import MainLayout from "../../layouts/MainLayout";

const API = "http://localhost:8000";

// ─── Format tanggal ke Bahasa Indonesia ───────────────────────────────────────
const formatTanggal = (iso) => {
  if (!iso) return "—";
  let isoStr = iso.includes("T") ? iso : iso.replace(" ", "T");
  if (!isoStr.endsWith("Z") && !isoStr.includes("+")) isoStr += "Z";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(isoStr));
};

const formatTanggalPendek = (iso) => {
  if (!iso) return "—";
  let isoStr = iso.includes("T") ? iso : iso.replace(" ", "T");
  if (!isoStr.endsWith("Z") && !isoStr.includes("+")) isoStr += "Z";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(isoStr));
};

// ─── Star Icon ────────────────────────────────────────────────────────────────
function StarIcon({ filled }) {
  return filled ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

// ─── Modal Konfirmasi Hapus ───────────────────────────────────────────────────
function DeleteModal({ hist, onConfirm, onCancel, isDeleting }) {
  const allInputs = [...(hist?.diagnoses || []), ...(hist?.symptoms || [])];
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white rounded-[28px] shadow-2xl max-w-sm w-full p-8 animate-[slideUp_0.25s_ease-out]">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 className="text-lg font-extrabold text-gray-800 text-center mb-2">Hapus Riwayat?</h3>
        <p className="text-gray-500 text-sm text-center mb-1 font-medium">
          {allInputs.length > 0 ? allInputs.join(", ") : "Analisis Umum"}
        </p>
        <p className="text-gray-400 text-xs text-center mb-6">{formatTanggalPendek(hist?.created_at)}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting} className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold transition-colors text-sm">
            Batal
          </button>
          <button onClick={onConfirm} disabled={isDeleting} className={`flex-1 px-4 py-3 rounded-2xl font-bold text-white text-sm transition-all bg-red-500 hover:bg-red-600 ${isDeleting ? "opacity-50 cursor-not-allowed" : ""}`}>
            {isDeleting ? "Menghapus..." : "Ya, Hapus"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getCleanName = (rawName) =>
  rawName ? rawName.split(/[\r\n]+/).map(n => n.trim()).filter(n => n !== "").join(", ")
           : "Nama Herbal Tidak Diketahui";

// ─── Modal Detail Herbal ──────────────────────────────────────────────────────
function HerbDetailModal({ herb, onClose }) {
  if (!herb) return null;

  const fullCleanName = getCleanName(herb.name);
  const nameParts    = fullCleanName.split(",").map(n => n.trim()).filter(Boolean);
  const primaryName  = nameParts[0];
  const aliasNames   = nameParts.slice(1).join(", ");

  const isSocfindo =
    (herb.source_link  && herb.source_link.toLowerCase().includes("socfindo")) ||
    (herb.source_label && herb.source_label.toLowerCase().includes("socfindo"));

  const partsArray  = herb.part
    ? herb.part.split(/[\r\n]+/).map(p => p.trim()).filter(Boolean)
    : ["Tidak Terdata"];
  const prepsArray  = partsArray.length > 1 && herb.preparation
    ? herb.preparation.split(/[\r\n]+/).map(p => p.trim()).filter(Boolean)
    : [herb.preparation || "Informasi penyiapan belum tersedia."];
  const imagesArray = partsArray.length > 1 && herb.part_image
    ? herb.part_image.split(/[\r\n]+/).map(p => p.trim()).filter(Boolean)
    : [herb.part_image];
  const isMultiPart = partsArray.length > 1;

  const sourceLinks  = herb.source_link  ? herb.source_link.split(/[\r\n]+/).map(s => s.trim()).filter(s => s && s !== "-")  : [];
  const sourceLabels = herb.source_label ? herb.source_label.split(/[\r\n]+/).map(s => s.trim()).filter(s => s && s !== "-") : [];

  return (
    <div
      className="fixed inset-0 bg-dark-50/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 sm:p-6 animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-[28px] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-[slideUp_0.3s_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-white/60 hover:bg-white backdrop-blur-md rounded-full text-gray-500 hover:text-red-500 transition-colors shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="overflow-y-auto">
          <div className="h-64 sm:h-72 relative bg-gray-100 w-full shrink-0">
            {herb.image && (
              <img src={herb.image} alt={primaryName} className="w-full h-full object-cover"
                onError={e => { e.target.style.display = "none"; }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
            <div className="absolute bottom-6 left-6 right-14">
              <span className="inline-block px-3 py-1 mb-3 bg-primary-40 text-white text-xs font-bold uppercase tracking-widest rounded-lg shadow-sm">
                {herb.latin || "Spesies Herbal"}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight drop-shadow-md">
                {primaryName}
              </h2>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {aliasNames && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                  </svg>
                  Nama Daerah / Sinonim
                </h4>
                <p className="text-gray-700 text-sm leading-relaxed font-medium">{aliasNames}</p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.696 2.332a.75.75 0 01.304.757v4.161l.534.223a6 6 0 013.43 5.093v.016a.75.75 0 01-1.498.058v-.016a4.5 4.5 0 00-2.572-3.82l-.894-.373v4.069a.75.75 0 01-1.5 0V8.361l-.894.373a4.5 4.5 0 00-2.572 3.82v.016a.75.75 0 01-1.498-.058v-.016a6 6 0 013.43-5.093l.534-.223V3.089a.75.75 0 01.304-.757l3.8-1.52a.75.75 0 01.892.203z" clipRule="evenodd" />
                </svg>
                Varian Bagian &amp; Cara Penyiapan
              </h4>
              <div className="flex flex-col gap-5">
                {partsArray.map((partName, idx) => {
                  const prepText   = prepsArray[idx] || prepsArray[0];
                  const partImgUrl = imagesArray[idx] || imagesArray[0];

                  let renderPrep;
                  if (isSocfindo) {
                    const steps = prepText.includes("\n") ? prepText.split(/[\r\n]+/) : prepText.split(/\.\s+/);
                    const clean = steps.map(s => s.trim()).filter(Boolean);
                    renderPrep = clean.length > 1
                      ? <div className="bg-gray-50 p-4 rounded-xl">
                          <ol className="list-decimal list-outside ml-5 space-y-2 text-gray-700 text-sm leading-relaxed marker:text-primary-40 marker:font-bold">
                            {clean.map((step, i) => <li key={i} className="pl-1">{step.endsWith(".") ? step : step + "."}</li>)}
                          </ol>
                        </div>
                      : <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                          <p className="text-gray-700 text-sm leading-relaxed">{clean[0]?.endsWith(".") ? clean[0] : (clean[0] || "") + "."}</p>
                        </div>;
                  } else {
                    const paragraphs = prepText.split(/(?:\r?\n){2,}/).map(p => p.trim()).filter(Boolean);
                    renderPrep = (
                      <div className="space-y-3">
                        {paragraphs.map((para, pIdx) => {
                          let badge = null, content = para;
                          const colonIdx = para.indexOf(":");
                          if (colonIdx > 0 && colonIdx <= 25) {
                            badge   = para.substring(0, colonIdx).trim();
                            content = para.substring(colonIdx + 1).trim();
                          }
                          return (
                            <div key={pIdx} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                              {badge && <span className="inline-flex mb-2 px-3 py-1 bg-primary-10 text-primary-60 text-[10px] font-bold uppercase tracking-widest rounded-md">Metode: {badge}</span>}
                              <p className="text-gray-700 text-sm leading-relaxed text-justify">{content.replace(/[\r\n]+/g, " ")}</p>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  return (
                    <div key={idx} className={`${isMultiPart ? "bg-primary-10/20 border-primary-20" : "bg-gray-50 border-gray-100"} border rounded-2xl p-5 hover:shadow-sm transition-all`}>
                      <h5 className="font-bold text-base text-gray-800 mb-4 flex items-center gap-2">
                        {isMultiPart && <span className="bg-emerald-100 text-emerald-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">{idx + 1}</span>}
                        {isMultiPart ? `Bagian ${partName}` : `Bagian: ${partName}`}
                      </h5>
                      {partImgUrl && partImgUrl !== "-" && (
                        <div className="w-full h-44 sm:h-52 rounded-xl mb-5 overflow-hidden bg-white border border-gray-100 shadow-sm flex items-center justify-center p-2">
                          <img src={partImgUrl} alt={`Bagian ${partName}`}
                            className="max-w-full max-h-full object-contain hover:scale-105 transition-transform duration-500"
                            onError={e => { e.target.style.display = "none"; }} />
                        </div>
                      )}
                      {renderPrep}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-dashed border-gray-200">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Sumber Kajian &amp; Referensi</h4>
              <div className="flex flex-col gap-2">
                {sourceLinks.length === 0 && sourceLabels.length === 0 && (
                  <span className="text-sm text-gray-400 italic">Tidak ada referensi tertaut.</span>
                )}
                {sourceLinks.map((link, i) => (
                  <a key={`link-${i}`} href={link} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-primary-10 text-sm text-primary-40 hover:text-primary-60 transition-colors border border-transparent hover:border-primary-20">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <span className="line-clamp-2 leading-snug break-all font-medium">{sourceLabels[i] || link}</span>
                  </a>
                ))}
                {sourceLabels.map((label, i) => {
                  if (sourceLinks[i]) return null;
                  return (
                    <div key={`label-${i}`} className="inline-flex items-start gap-3 p-3 rounded-xl bg-gray-50 text-sm text-gray-700 border border-gray-100">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 text-gray-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <span className="leading-snug">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Card Riwayat ─────────────────────────────────────────────────────────────
function RiwayatCard({ hist, index, onDelete, onSelectHerb, isFavorite, onToggleFavorite }) {
  const [expanded, setExpanded] = useState(true);
  const [starAnimating, setStarAnimating] = useState(false);

  const allInputs  = [...(hist.diagnoses || []), ...(hist.symptoms || [])];
  const totalHerbs = hist.recommendations?.reduce((s, g) => s + g.herbs.length, 0) || 0;
  const totalGroups = hist.recommendations?.length || 0;
  const hasCondition = hist.special_conditions?.length > 0 && hist.special_conditions[0] !== "Tidak ada";

  const handleStarClick = (e) => {
    e.stopPropagation();
    setStarAnimating(true);
    onToggleFavorite(hist.id);
    setTimeout(() => setStarAnimating(false), 300);
  };

  return (
    <div
      className="animate-[staggeredFadeIn_0.5s_ease-out_forwards]"
      style={{ opacity: 0, animationDelay: `${index * 80}ms` }}
    >
      <div className={`bg-white rounded-[24px] border transition-all duration-300 overflow-hidden ${expanded ? "border-primary-30 shadow-xl shadow-primary-10/60" : "border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200"}`}>

        {/* ── Header Card ── */}
        <div className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            {/* Kiri: tanggal + judul */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-400 mb-1.5 flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatTanggal(hist.created_at)}
              </p>
              <h3 className="text-base md:text-lg font-extrabold text-gray-800 leading-snug truncate pr-2">
                {allInputs.length > 0 ? allInputs.join(", ") : "Analisis Umum"}
              </h3>

              {/* Badge kondisi khusus */}
              {hasCondition && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {hist.special_conditions.filter(c => c !== "Tidak ada").map((c, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold rounded-full">
                      ⚠️ {c}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Kanan: star + badges */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="flex items-center gap-2">
                {/* ⭐ Star Button — di antara tanggal-area dan badge herbal */}
                <button
                  onClick={handleStarClick}
                  title={isFavorite ? "Hapus dari favorit" : "Tambah ke favorit"}
                  className={`
                    p-1.5 rounded-full transition-all duration-200
                    ${isFavorite
                      ? "text-amber-400 hover:bg-amber-50"
                      : "text-gray-400 hover:text-amber-400 hover:bg-amber-50"}
                    ${starAnimating ? "scale-125" : "scale-100"}
                  `}
                  style={{ transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1), color 0.2s" }}
                >
                  <StarIcon filled={isFavorite} />
                </button>

                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-10 text-primary-50 text-xs font-bold rounded-full">
                  🌿 {totalHerbs} Herbal
                </span>
                {hist.chemical_drugs?.includes("Ya") && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 text-xs font-bold rounded-full">
                    💊 Obat Kimia
                  </span>
                )}
              </div>
              {totalGroups > 0 && (
                <span className="text-xs text-gray-400 font-medium">{totalGroups} kategori penyakit</span>
              )}
            </div>
          </div>

          {/* ── Action Buttons ── */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
            <button
              onClick={() => setExpanded(!expanded)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 ${expanded ? "bg-primary-50 text-white shadow-sm" : "bg-primary-10 text-primary-50 hover:bg-primary-20"}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
              {expanded ? "Sembunyikan Hasil" : "Lihat Rekomendasi"}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onDelete(hist); }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold text-red-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Hapus
            </button>
          </div>
        </div>

        {/* ── Panel Rekomendasi ── */}
        {expanded && hist.recommendations && hist.recommendations.length > 0 && (
          <div className="border-t border-gray-100 bg-gray-50/50 px-5 md:px-6 pt-4 pb-5">
            <div className="space-y-6">
              {hist.recommendations.map((group, gi) => (
                <div key={gi}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${group.group_type === "Analisis AI" ? "bg-purple-100 text-purple-600" : "bg-primary-10 text-primary-50"}`}>
                      {group.group_type === "Analisis AI" ? "🤖 Analisis AI" : "🔍 Pencocokan"}
                    </span>
                    <p className="text-sm font-bold text-gray-700">{group.group_name}</p>
                    <span className="ml-auto text-xs text-gray-400 font-semibold">{group.herbs.length} herbal</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {group.herbs.map((herb, hi) => (
                      <div
                        key={hi}
                        onClick={() => onSelectHerb(herb)}
                        className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-primary-30 hover:shadow-md transition-all duration-200 flex cursor-pointer group/herb"
                      >
                        <div className="w-20 shrink-0 bg-gradient-to-b from-primary-10/50 to-green-50 flex items-center justify-center overflow-hidden">
                          {herb.image ? (
                            <img src={herb.image} alt={herb.name} className="w-full h-full object-cover group-hover/herb:scale-105 transition-transform duration-300"
                              onError={(e) => { e.target.onerror = null; e.target.parentElement.innerHTML = '<span style="font-size:1.8rem">🌿</span>'; }} />
                          ) : (
                            <span className="text-3xl">🌿</span>
                          )}
                        </div>
                        <div className="flex-1 p-3 min-w-0">
                          {(() => {
                            const clean = getCleanName(herb.name);
                            const primary = clean.split(",")[0].trim();
                            return (
                              <p className="text-sm font-extrabold text-gray-800 leading-snug line-clamp-1 group-hover/herb:text-primary-50 transition-colors" title={clean}>
                                {primary}
                              </p>
                            );
                          })()}
                          {herb.latin && <p className="text-xs text-gray-400 italic mb-1 truncate">{herb.latin}</p>}
                          {herb.part && (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full font-semibold mt-1">
                              🍃 {herb.part}
                            </span>
                          )}
                          {herb.preparation && (
                            <p className="text-[10px] text-gray-400 mt-1.5 line-clamp-1">📋 {herb.preparation}</p>
                          )}
                          <p className="text-[10px] text-primary-40 font-bold mt-1.5 flex items-center gap-1">
                            Baca selengkapnya
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {expanded && (!hist.recommendations || hist.recommendations.length === 0) && (
          <div className="border-t border-gray-50 bg-gray-50/60 px-6 py-8 text-center">
            <p className="text-gray-400 text-sm font-medium">Tidak ada data rekomendasi tersimpan.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Filter waktu: periode tetap (kalender lokal browser) ─────────────────────
// Opsi 1 — Minggu Ini: tanggal_rekam >= (tengah malam hari ini − 7 hari kalender)
//          Bulan Ini:   tanggal_rekam >= (tengah malam hari ini − 30 hari kalender)
// Tidak pakai label dinamis; batas bawah dihitung sekali dari “hari ini”.
function parseHistoryDate(isoOrDb) {
  if (!isoOrDb) return null;
  let s = String(isoOrDb).trim();
  if (s.includes(" ") && !s.includes("T")) s = s.replace(" ", "T");
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function startOfLocalCalendarDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** true jika tanggal kalender (lokal) rekaman >= (hari ini lokal − daysBack) dan tidak di masa depan */
function matchesPeriodFromToday(createdAt, daysBack) {
  const recordDate = parseHistoryDate(createdAt);
  if (!recordDate) return false;
  const now = new Date();
  const todayStart = startOfLocalCalendarDay(now);
  const lowerBound = new Date(todayStart);
  lowerBound.setDate(lowerBound.getDate() - daysBack);
  const recordDay = startOfLocalCalendarDay(recordDate);
  return recordDay >= lowerBound && recordDate <= now;
}

// ─── localStorage helpers untuk favorites ─────────────────────────────────────
const FAV_KEY = "herbalyze_riwayat_favorites";

const loadFavorites = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]"));
  } catch {
    return new Set();
  }
};

const saveFavorites = (set) => {
  localStorage.setItem(FAV_KEY, JSON.stringify([...set]));
};

// ─── KOMPONEN UTAMA ───────────────────────────────────────────────────────────
export default function Riwayat() {
  const [histories, setHistories]     = useState([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState(null);

  // Filter
  const [searchTerm, setSearchTerm]   = useState("");
  const [timeFilter, setTimeFilter]   = useState("semua");

  // Favorites
  const [favorites, setFavorites]     = useState(loadFavorites);

  // Modal & notif
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting]     = useState(false);
  const [notification, setNotification] = useState(null);
  const [selectedHerb, setSelectedHerb] = useState(null);

  // ── Fetch riwayat ────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const wallet = localStorage.getItem("user_wallet");
    if (!wallet) {
      setError("Sesi Anda belum aktif. Silakan masuk terlebih dahulu.");
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API}/api/history/${wallet}`);
      if (!res.ok) throw new Error("Gagal memuat data.");
      const data = await res.json();
      setHistories(data);
    } catch {
      setError("Koneksi terputus. Pastikan server sedang berjalan.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Segarkan riwayat saat kembali ke tab/halaman (agar terasa "real time" setelah cari di tab lain)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchHistory();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchHistory]);

  // Auto-dismiss notif
  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  // ── Toggle Favorite ───────────────────────────────────────────────────────
  const handleToggleFavorite = useCallback((histId) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(histId)) {
        next.delete(histId);
      } else {
        next.add(histId);
      }
      saveFavorites(next);
      return next;
    });
  }, []);

  // ── Filter engine ─────────────────────────────────────────────────────────
  const filteredHistories = histories.filter((hist) => {
    const allInputs = [...(hist.diagnoses || []), ...(hist.symptoms || [])].join(" ").toLowerCase();
    const matchesSearch = allInputs.includes(searchTerm.toLowerCase());

    // Favorit tab
    if (timeFilter === "favorit") return matchesSearch && favorites.has(hist.id);

    let matchesTime = true;
    if (timeFilter !== "semua" && timeFilter !== "favorit") {
      if (!hist.created_at) {
        matchesTime = false;
      } else if (timeFilter === "minggu") {
        matchesTime = matchesPeriodFromToday(hist.created_at, 7);
      } else if (timeFilter === "bulan") {
        matchesTime = matchesPeriodFromToday(hist.created_at, 30);
      }
    }

    return matchesSearch && matchesTime;
  });

  // ── Handler hapus ─────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const wallet = localStorage.getItem("user_wallet");
      const res = await fetch(`${API}/api/history/${deleteTarget.id}?wallet_address=${wallet}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus riwayat.");
      // Juga hapus dari favorit jika ada
      setFavorites(prev => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        saveFavorites(next);
        return next;
      });
      setHistories((prev) => prev.filter((h) => h.id !== deleteTarget.id));
      setNotification({ type: "success", message: "Riwayat berhasil dihapus." });
    } catch (err) {
      setNotification({ type: "error", message: err.message });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const totalHerbsAll  = histories.reduce((s, h) =>
    s + (h.recommendations?.reduce((x, g) => x + g.herbs.length, 0) || 0), 0);
  const totalFavorites = histories.filter(h => favorites.has(h.id)).length;

  const isFavoritTab = timeFilter === "favorit";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <MainLayout>
      {/* Modal Hapus */}
      {deleteTarget && (
        <DeleteModal
          hist={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          isDeleting={isDeleting}
        />
      )}

      {/* Toast */}
      {notification && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold animate-[slideUp_0.3s_ease-out] ${notification.type === "success" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
          {notification.type === "success" ? "✅ " : "❌ "}{notification.message}
        </div>
      )}

      {/* BG Gradient */}
      <div className="absolute top-0 inset-x-0 h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-10/60 via-white to-transparent -z-10" />

      <div className="max-w-3xl mx-auto pt-10 md:pt-14 px-4 pb-28 min-h-[75vh]">

        {/* ── Page Header ── */}
        <div className="text-center mb-10 animate-[fadeIn_0.5s_ease-out]">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-white border border-gray-100 shadow-lg mb-5 hover:scale-105 transition-transform duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 mb-2 tracking-tight">
            Riwayat <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-60 to-primary-40">Pencarian</span>
          </h1>
          <p className="text-gray-500 text-base max-w-md mx-auto font-medium">
            Semua hasil analisis herbal Anda tersimpan di sini.
          </p>

          {/* ── Stats Bar (2 stat + Favorit, tanpa Ditampilkan) ── */}
          {!isLoading && !error && histories.length > 0 && (
            <div className="flex items-center justify-center gap-6 mt-5">
              <div className="text-center">
                <p className="text-2xl font-extrabold text-gray-800">{histories.length}</p>
                <p className="text-xs text-gray-400 font-semibold">Total Riwayat</p>
              </div>
              <div className="w-px h-8 bg-gray-200"></div>
              <div className="text-center">
                <p className="text-2xl font-extrabold text-primary-50">{totalHerbsAll}</p>
                <p className="text-xs text-gray-400 font-semibold">Total Herbal</p>
              </div>
              <div className="w-px h-8 bg-gray-200"></div>
              <div className="text-center">
                <p className="text-2xl font-extrabold text-amber-500">{totalFavorites}</p>
                <p className="text-xs text-gray-400 font-semibold">⭐ Favorit</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Filter Bar ── */}
        {!isLoading && !error && histories.length > 0 && (
          <div className="bg-white/80 backdrop-blur-xl border border-gray-100/80 rounded-[20px] p-3.5 shadow-sm mb-8 flex flex-col sm:flex-row gap-3 animate-[slideDown_0.4s_ease-out]">
            {/* Search */}
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-gray-400">
                <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Cari penyakit atau gejala..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-20 focus:border-primary-30 transition-all"
              />
            </div>

            {/* Time filter tabs — sekarang termasuk Favorit */}
            <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100 gap-1 flex-wrap sm:flex-nowrap">
              {[
                { id: "semua",   label: "Semua" },
                { id: "minggu",  label: "Minggu Ini" },
                { id: "bulan",   label: "Bulan Ini" },
                { id: "favorit", label: "⭐ Favorit" },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setTimeFilter(btn.id)}
                  className={`flex-1 px-3 py-2 text-xs font-bold rounded-lg transition-all duration-200 whitespace-nowrap
                    ${timeFilter === btn.id
                      ? btn.id === "favorit"
                        ? "bg-amber-50 text-amber-600 shadow-sm border border-amber-100"
                        : "bg-white text-primary-50 shadow-sm border border-gray-100"
                      : "text-gray-400 hover:text-gray-600"
                    }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="relative w-12 h-12 mb-5">
              <div className="absolute inset-0 border-4 border-primary-10 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-primary-50 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <p className="text-gray-400 font-semibold text-sm">Memuat riwayat Anda...</p>
          </div>
        )}

        {/* ── Error ── */}
        {!isLoading && error && (
          <div className="bg-white border border-red-100 rounded-[24px] p-10 text-center shadow-sm">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-700 mb-2">Gagal Memuat</h3>
            <p className="text-gray-400 text-sm mb-5">{error}</p>
            <button onClick={fetchHistory} className="px-6 py-2.5 bg-primary-50 text-white rounded-full text-sm font-bold hover:bg-primary-60 transition-colors">
              Coba Lagi
            </button>
          </div>
        )}

        {/* ── Empty (belum ada riwayat sama sekali) ── */}
        {!isLoading && !error && histories.length === 0 && (
          <div className="bg-white border-2 border-dashed border-gray-200 hover:border-primary-20 transition-colors rounded-[28px] p-14 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <span className="text-4xl">🌿</span>
            </div>
            <h3 className="text-xl font-extrabold text-gray-700 mb-2">Belum Ada Riwayat</h3>
            <p className="text-gray-400 text-sm mb-7 max-w-xs mx-auto leading-relaxed">
              Mulai analisis herbal pertama Anda dan hasilnya akan tersimpan otomatis di sini.
            </p>
            <a href="/home" className="inline-flex items-center gap-2 px-6 py-3 bg-primary-50 hover:bg-primary-60 text-white rounded-full font-bold text-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary-20">
              Mulai Analisis
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </a>
          </div>
        )}

        {/* ── Empty Favorit ── */}
        {!isLoading && !error && histories.length > 0 && isFavoritTab && filteredHistories.length === 0 && (
          <div className="bg-white border-2 border-dashed border-amber-100 hover:border-amber-200 transition-colors rounded-[28px] p-14 text-center">
            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <h3 className="text-xl font-extrabold text-gray-700 mb-2">Belum ada riwayat favorit</h3>
            <p className="text-gray-400 text-sm max-w-xs mx-auto leading-relaxed">
              Tandai riwayat pencarian dengan ⭐ untuk menyimpannya di sini.
            </p>
          </div>
        )}

        {/* ── No result (filter selain favorit) ── */}
        {!isLoading && !error && histories.length > 0 && !isFavoritTab && filteredHistories.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-[24px] p-10 text-center shadow-sm">
            <span className="text-4xl mb-3 block">🔍</span>
            <h4 className="text-base font-bold text-gray-700 mb-1">Tidak Ditemukan</h4>
            <p className="text-gray-400 text-sm mb-4">Tidak ada riwayat yang cocok dengan pencarian Anda.</p>
            <button
              onClick={() => { setSearchTerm(""); setTimeFilter("semua"); }}
              className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full text-sm font-bold transition-colors"
            >
              Reset Filter
            </button>
          </div>
        )}

        {/* ── List Riwayat ── */}
        {!isLoading && !error && filteredHistories.length > 0 && (
          <div className="space-y-3">
            {filteredHistories.map((hist, index) => (
              <RiwayatCard
                key={hist.id}
                hist={hist}
                index={index}
                onDelete={setDeleteTarget}
                onSelectHerb={setSelectedHerb}
                isFavorite={favorites.has(hist.id)}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal detail herbal */}
      {selectedHerb && (
        <HerbDetailModal herb={selectedHerb} onClose={() => setSelectedHerb(null)} />
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-15px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes staggeredFadeIn { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </MainLayout>
  );
}