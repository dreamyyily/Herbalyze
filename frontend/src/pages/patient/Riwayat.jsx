import { useState, useEffect, useCallback } from "react";
import MainLayout from "../../layouts/MainLayout";
import { AlertTriangle, ShieldAlert, X, Info, BookOpen } from "lucide-react";

const API = "http://localhost:8000";

// ─── Format tanggal ke Bahasa Indonesia ───────────────────────────────────────
const formatTanggal = (iso) => {
  if (!iso) return "—";
  let isoStr = iso.includes("T") ? iso : iso.replace(" ", "T");
  if (!isoStr.endsWith("Z") && !isoStr.includes("+")) isoStr += "Z";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoStr));
};

const formatTanggalPendek = (iso) => {
  if (!iso) return "—";
  let isoStr = iso.includes("T") ? iso : iso.replace(" ", "T");
  if (!isoStr.endsWith("Z") && !isoStr.includes("+")) isoStr += "Z";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(isoStr));
};

// ─── Star Icon ────────────────────────────────────────────────────────────────
function StarIcon({ filled }) {
  return filled ? (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="#F59E0B"
      stroke="#F59E0B"
      strokeWidth={1}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      />
    </svg>
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getCleanName = (rawName) =>
  rawName
    ? rawName
        .split(/[\r\n]+/)
        .map((n) => n.trim())
        .filter((n) => n !== "")
        .join(", ")
    : "Nama Herbal Tidak Diketahui";

// ─── Modal Analisis Risiko Herbal (identik dengan ResultSection) ──────────────
function UnsafeHerbModal({ herb, onClose }) {
  if (!herb) return null;

  // Pisahkan nama utama dan alias dari full_name / name
  const rawName = herb.full_name || herb.name || "";
  const nameParts = rawName
    .split(/[\r\n,]+/)
    .map((n) => n.trim())
    .filter(Boolean);
  const primaryName = nameParts[0] || "Herbal Tidak Diketahui";
  const aliasNames = nameParts.slice(1); // sisa = alias/daerah

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-xl animate-[fadeIn_0.2s]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5 animate-[slideUp_0.3s]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header: icon + close */}
          <div className="flex justify-between items-center mb-5">
            <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center">
              <ShieldAlert size={22} />
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Nama Utama Herbal — hanya nama pertama */}
          <h2 className="text-xl font-black text-slate-800 leading-snug mb-1">
            {primaryName}
          </h2>

          {/* Alias / Nama Daerah — tampil kecil di bawah nama utama */}
          {aliasNames.length > 0 && (
            <p className="text-xs text-slate-400 font-medium leading-relaxed mb-4 line-clamp-2">
              {aliasNames.join(", ")}
            </p>
          )}

          {/* Alasan risiko */}
          <div className="flex items-center gap-2.5 p-3 bg-rose-50 rounded-xl border border-rose-100 mb-5">
            <AlertTriangle className="text-rose-500 shrink-0" size={16} />
            <p className="text-[11px] font-black text-rose-700 uppercase tracking-tight">
              {herb.reason}
            </p>
          </div>

          <div className="space-y-3">
            {/* Analisis Efek Samping */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2 flex items-center gap-1.5">
                <Info size={12} className="text-indigo-500" /> Analisis Efek
                Samping
              </h4>
              <p className="text-[13px] text-slate-600 leading-relaxed">
                {herb.description}
              </p>
            </div>

            {/* Referensi Klinis */}
            {herb.reference && herb.reference !== "-" && (
              <div className="bg-indigo-50/60 rounded-2xl p-4 border border-indigo-100/60">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2 flex items-center gap-1.5">
                  <BookOpen size={12} className="text-indigo-600" /> Referensi
                  Klinis
                </h4>
                <p className="text-[11px] text-indigo-800/80 italic leading-relaxed">
                  "{herb.reference}"
                </p>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full mt-5 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase shadow-lg hover:bg-slate-800 transition-all active:scale-95 text-xs tracking-widest"
          >
            SAYA MENGERTI &amp; TUTUP
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Detail Herbal (HerbDetailModal) — diperkecil & dirapikan ──────────
function HerbDetailModal({ herb, onClose, showMedicalWarning }) {
  if (!herb) return null;

  const fullCleanName = getCleanName(herb.name);
  const nameParts = fullCleanName
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  const primaryName = nameParts[0];
  const aliasNames = nameParts.slice(1).join(", ");

  const isSocfindo =
    (herb.source_link && herb.source_link.toLowerCase().includes("socfindo")) ||
    (herb.source_label && herb.source_label.toLowerCase().includes("socfindo"));

  const partsArray = herb.part
    ? herb.part
        .split(/[\r\n]+/)
        .map((p) => p.trim())
        .filter(Boolean)
    : ["Tidak Terdata"];
  const prepsArray =
    partsArray.length > 1 && herb.preparation
      ? herb.preparation
          .split(/[\r\n]+/)
          .map((p) => p.trim())
          .filter(Boolean)
      : [herb.preparation || "Informasi penyiapan belum tersedia."];
  const imagesArray =
    partsArray.length > 1 && herb.part_image
      ? herb.part_image
          .split(/[\r\n]+/)
          .map((p) => p.trim())
          .filter(Boolean)
      : [herb.part_image];
  const isMultiPart = partsArray.length > 1;

  const sourceLinks = herb.source_link
    ? herb.source_link
        .split(/[\r\n]+/)
        .map((s) => s.trim())
        .filter((s) => s && s !== "-")
    : [];
  const sourceLabels = herb.source_label
    ? herb.source_label
        .split(/[\r\n]+/)
        .map((s) => s.trim())
        .filter((s) => s && s !== "-")
    : [];

  return (
    <div
      className="fixed inset-0 bg-dark-50/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 sm:p-6 animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      {/* max-w-2xl → max-w-xl untuk ukuran lebih compact seperti ResultSection */}
      <div
        className="relative bg-light-10 rounded-[32px] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-[slideUp_0.3s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-light-10/50 hover:bg-light-10 backdrop-blur-md rounded-full text-dark-30 hover:text-danger-30 transition-colors shadow-sm"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="overflow-y-auto">
          {/* Header gambar — dikurangi tingginya agar lebih compact */}
          <div className="h-48 sm:h-56 relative bg-light-30 w-full shrink-0">
            {herb.image && (
              <img
                src={herb.image}
                alt={primaryName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-dark-50/90 via-dark-50/30 to-transparent" />
            <div className="absolute bottom-4 left-5 right-12">
              <span className="inline-block px-2.5 py-0.5 mb-2 bg-primary-40 text-light-10 text-[10px] font-bold uppercase tracking-widest rounded-lg shadow-sm">
                {herb.latin || "Spesies Herbal"}
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-light-10 leading-tight drop-shadow-md">
                {primaryName}
              </h2>
            </div>
          </div>

          {/* Body konten — padding dikurangi agar lebih rapat */}
          <div className="p-5 sm:p-6 space-y-5">
            {/* Peringatan Obat Kimia */}
            {showMedicalWarning && (
              <div className="bg-danger-30/10 border-l-4 border-danger-30 p-4 rounded-r-2xl shadow-sm animate-[fadeIn_0.5s_ease-out]">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-light-10 rounded-full text-danger-30 flex-shrink-0 mt-0.5">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-danger-30 mb-1">
                      Instruksi Keamanan Medis!
                    </h4>
                    <p className="text-xs text-danger-30/90 leading-relaxed">
                      Karena Anda sedang mengonsumsi obat medis/kimia, Anda{" "}
                      <strong>WAJIB memberikan jeda waktu minimal 2 jam</strong>{" "}
                      sebelum atau sesudah meminum ramuan herbal ini untuk
                      mencegah interaksi obat yang membahayakan fungsi hati.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Nama Alias/Sinonim */}
            {aliasNames && (
              <div className="bg-light-20 border border-light-40 rounded-2xl p-4">
                <h4 className="text-xs font-bold text-dark-30 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
                    />
                  </svg>
                  Nama Daerah / Sinonim
                </h4>
                <p className="text-dark-40 text-sm leading-relaxed font-medium">
                  {aliasNames}
                </p>
              </div>
            )}

            {/* Varian Bagian & Cara Penyiapan */}
            <div>
              <h4 className="text-sm font-bold text-dark-30 uppercase tracking-widest mb-3 flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-emerald-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M11.696 2.332a.75.75 0 01.304.757v4.161l.534.223a6 6 0 013.43 5.093v.016a.75.75 0 01-1.498.058v-.016a4.5 4.5 0 00-2.572-3.82l-.894-.373v4.069a.75.75 0 01-1.5 0V8.361l-.894.373a4.5 4.5 0 00-2.572 3.82v.016a.75.75 0 01-1.498-.058v-.016a6 6 0 013.43-5.093l.534-.223V3.089a.75.75 0 01.304-.757l3.8-1.52a.75.75 0 01.892.203z"
                    clipRule="evenodd"
                  />
                </svg>
                Varian Bagian &amp; Cara Penyiapan
              </h4>
              <div className="flex flex-col gap-4">
                {partsArray.map((partName, idx) => {
                  const prepText = prepsArray[idx] || prepsArray[0];
                  const partImgUrl = imagesArray[idx] || imagesArray[0];

                  let renderPrep;
                  if (isSocfindo) {
                    const steps = prepText.includes("\n")
                      ? prepText.split(/[\r\n]+/)
                      : prepText.split(/\.\s+/);
                    const clean = steps.map((s) => s.trim()).filter(Boolean);
                    renderPrep =
                      clean.length > 1 ? (
                        <div className="bg-light-10/50 p-4 rounded-xl">
                          <ol className="list-decimal list-outside ml-5 space-y-2 text-dark-40 text-sm leading-relaxed marker:text-primary-40 marker:font-bold">
                            {clean.map((step, i) => (
                              <li key={i} className="pl-1">
                                {step.endsWith(".") ? step : step + "."}
                              </li>
                            ))}
                          </ol>
                        </div>
                      ) : (
                        <div className="bg-light-10/80 p-4 rounded-xl border border-light-40/50">
                          <p className="text-dark-40 text-sm leading-relaxed">
                            {clean[0]?.endsWith(".")
                              ? clean[0]
                              : (clean[0] || "") + "."}
                          </p>
                        </div>
                      );
                  } else {
                    const paragraphs = prepText
                      .split(/(?:\r?\n){2,}/)
                      .map((p) => p.trim())
                      .filter(Boolean);
                    renderPrep = (
                      <div className="space-y-3">
                        {paragraphs.map((para, pIdx) => {
                          let badge = null,
                            content = para;
                          const colonIdx = para.indexOf(":");
                          if (colonIdx > 0 && colonIdx <= 25) {
                            badge = para.substring(0, colonIdx).trim();
                            content = para.substring(colonIdx + 1).trim();
                          }
                          return (
                            <div
                              key={pIdx}
                              className="bg-light-10/80 p-4 rounded-xl border border-light-40/50"
                            >
                              {badge && (
                                <span className="inline-flex mb-2 px-3 py-1 bg-primary-10 text-primary-60 text-[10px] font-bold uppercase tracking-widest rounded-md">
                                  Metode: {badge}
                                </span>
                              )}
                              <p className="text-dark-40 text-sm leading-relaxed text-justify">
                                {content.replace(/[\r\n]+/g, " ")}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      className={`${isMultiPart ? "bg-primary-10/30 border-primary-20" : "bg-light-20/60 border-light-40"} border rounded-2xl p-4 sm:p-5 hover:shadow-sm transition-all`}
                    >
                      <h5 className="font-bold text-base text-dark-50 mb-3 flex items-center gap-2">
                        {isMultiPart && (
                          <span className="bg-emerald-100 text-emerald-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">
                            {idx + 1}
                          </span>
                        )}
                        {isMultiPart
                          ? `Bagian ${partName}`
                          : `Bagian: ${partName}`}
                      </h5>
                      {partImgUrl && partImgUrl !== "-" && (
                        <div className="w-full h-36 sm:h-44 rounded-xl mb-4 overflow-hidden bg-light-10 border border-light-40 shadow-sm flex items-center justify-center p-2">
                          <img
                            src={partImgUrl}
                            alt={`Bagian ${partName}`}
                            className="max-w-full max-h-full object-contain hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        </div>
                      )}
                      {renderPrep}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sumber & Referensi */}
            <div className="pt-4 border-t border-dashed border-light-40">
              <h4 className="text-xs font-bold text-dark-30 uppercase tracking-widest mb-3">
                Sumber Kajian &amp; Referensi
              </h4>
              <div className="flex flex-col gap-2">
                {sourceLinks.length === 0 && sourceLabels.length === 0 && (
                  <span className="text-sm text-dark-30 italic">
                    Tidak ada referensi tertaut.
                  </span>
                )}
                {sourceLinks.map((link, i) => (
                  <a
                    key={`link-${i}`}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-start gap-3 p-3 rounded-xl bg-light-20 hover:bg-primary-10 text-sm text-primary-40 hover:text-primary-60 transition-colors border border-transparent hover:border-primary-20"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 flex-shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                      />
                    </svg>
                    <span className="line-clamp-2 leading-snug break-all font-medium">
                      {sourceLabels[i] || link}
                    </span>
                  </a>
                ))}
                {sourceLabels.map((label, i) => {
                  if (sourceLinks[i]) return null;
                  return (
                    <div
                      key={`label-${i}`}
                      className="inline-flex items-start gap-3 p-3 rounded-xl bg-light-20 text-sm text-dark-40 border border-light-40"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 flex-shrink-0 text-dark-30 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                        />
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
function RiwayatCard({
  hist,
  index,
  onDelete,
  onSelectHerb,
  isFavorite,
  onToggleFavorite,
  isSelectMode,
  isSelected,
  onToggleSelect,
}) {
  const [expanded, setExpanded] = useState(false);
  const [starAnimating, setStarAnimating] = useState(false);
  const [selectedUnsafe, setSelectedUnsafe] = useState(null);

  const allInputs = [...(hist.diagnoses || []), ...(hist.symptoms || [])];
  const totalHerbs =
    hist.recommendations?.reduce((s, g) => s + g.herbs.length, 0) || 0;
  const totalUnsafe =
    hist.recommendations?.reduce(
      (s, g) => s + (g.unsafe_herbs?.length || 0),
      0,
    ) || 0;
  const totalGroups = hist.recommendations?.length || 0;
  const hasCondition =
    hist.special_conditions?.length > 0 &&
    hist.special_conditions[0] !== "Tidak ada";
  const hasChemical = hist.chemical_drugs?.includes("Ya");
  const hasAnyResult = totalHerbs > 0 || totalUnsafe > 0;

  const handleStarClick = (e) => {
    e.stopPropagation();
    setStarAnimating(true);
    onToggleFavorite(hist.id);
    setTimeout(() => setStarAnimating(false), 300);
  };

  const handleCardClick = () => {
    if (isSelectMode) onToggleSelect(hist.id);
  };

  return (
    <div
      className="animate-[staggeredFadeIn_0.5s_ease-out_forwards]"
      style={{ opacity: 0, animationDelay: `${index * 80}ms` }}
    >
      {selectedUnsafe && (
        <UnsafeHerbModal
          herb={selectedUnsafe}
          onClose={() => setSelectedUnsafe(null)}
        />
      )}

      <div
        onClick={handleCardClick}
        className={`bg-white rounded-[28px] border transition-all duration-300 overflow-hidden
          ${isSelectMode ? "cursor-pointer" : ""}
          ${
            isSelected
              ? "border-red-400 shadow-lg shadow-red-100/60 ring-2 ring-red-300/40"
              : expanded
                ? "border-primary-30 shadow-lg shadow-primary-10/40"
                : "border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200"
          }`}
      >
        <div className="p-6 md:p-8">
          {/* Baris atas: tanggal + checkbox */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {formatTanggal(hist.created_at)}
            </p>
            {isSelectMode && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(hist.id);
                }}
                className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-200 shrink-0 cursor-pointer
                  ${isSelected ? "bg-red-500 border-red-500 shadow-sm" : "border-gray-300 hover:border-red-400 bg-white"}`}
              >
                {isSelected && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
            )}
          </div>

          {/* Judul + bintang */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <h3
              className={`text-lg md:text-xl font-extrabold leading-snug transition-colors ${isSelected ? "text-red-600" : "text-gray-800"}`}
            >
              {allInputs.length > 0 ? allInputs.join(", ") : "Analisis Umum"}
            </h3>
            {!isSelectMode && (
              <button
                onClick={handleStarClick}
                title={isFavorite ? "Hapus dari favorit" : "Tambah ke favorit"}
                className={`shrink-0 p-2 rounded-full transition-all duration-200
                  ${isFavorite ? "text-amber-400 bg-amber-50 hover:bg-amber-100" : "text-gray-300 hover:text-amber-400 hover:bg-amber-50"}
                  ${starAnimating ? "scale-125" : "scale-100"}`}
                style={{
                  transition:
                    "transform 0.2s cubic-bezier(0.34,1.56,0.64,1), color 0.2s",
                }}
              >
                <StarIcon filled={isFavorite} />
              </button>
            )}
          </div>

          {hasCondition && (
            <div className="flex flex-wrap gap-2 mb-4">
              {hist.special_conditions
                .filter((c) => c !== "Tidak ada")
                .map((c, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold rounded-full"
                  >
                    ⚠️ {c}
                  </span>
                ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mb-5">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full ${totalHerbs > 0 ? "bg-primary-10 text-primary-50" : "bg-gray-50 border border-gray-100 text-gray-400"}`}
            >
              🌿 {totalHerbs} Herbal Direkomendasikan
            </span>
            {totalUnsafe > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 text-xs font-bold rounded-full border border-rose-100">
                ⛔ {totalUnsafe} Perlu Dihindari
              </span>
            )}
            {hasChemical && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 text-xs font-bold rounded-full border border-orange-100">
                💊 Obat Kimia
              </span>
            )}
            {totalGroups > 0 && (
              <span className="inline-flex items-center px-3 py-1.5 bg-gray-50 border border-gray-100 text-gray-500 text-xs font-semibold rounded-full">
                {totalGroups} kategori
              </span>
            )}
          </div>

          {!isSelectMode && (
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              {hasAnyResult ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(!expanded);
                  }}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200 ${expanded ? "bg-primary-50 text-white shadow-sm" : "bg-primary-10 text-primary-50 hover:bg-primary-20"}`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                  {expanded ? "Sembunyikan Detail" : "Lihat Detail Hasil"}
                </button>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-100 rounded-full">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-amber-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-xs font-bold text-amber-700">
                    Tidak ada herbal yang relevan ditemukan
                  </span>
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(hist);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold text-red-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Hapus
              </button>
            </div>
          )}

          {isSelectMode && (
            <div className="pt-4 border-t border-gray-100">
              <p className="text-xs text-center font-semibold text-gray-400">
                {isSelected
                  ? "✅ Dipilih untuk dihapus"
                  : "Ketuk card untuk memilih"}
              </p>
            </div>
          )}
        </div>

        {/* Panel Detail (expanded) */}
        {expanded && hasAnyResult && (
          <div className="border-t border-gray-100 bg-gray-50/60 px-6 md:px-8 pt-6 pb-8 space-y-8">
            {hist.recommendations?.map((group, gi) => {
              const groupHasHerbs = group.herbs?.length > 0;
              const groupHasUnsafe = (group.unsafe_herbs?.length || 0) > 0;
              if (!groupHasHerbs && !groupHasUnsafe) return null;
              const isDiagnosis =
                group.group_type?.toLowerCase() === "diagnosis";

              return (
                <div key={gi} className="space-y-5">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDiagnosis ? "bg-indigo-100 text-indigo-600" : "bg-orange-100 text-orange-600"}`}
                    >
                      {isDiagnosis ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-[10px] font-extrabold uppercase tracking-widest ${isDiagnosis ? "text-indigo-500" : "text-orange-500"}`}
                      >
                        {group.group_type}
                      </p>
                      <p className="text-sm font-extrabold text-gray-800 capitalize leading-tight">
                        {group.group_name?.replace("Terkait: ", "")}
                      </p>
                    </div>
                    {groupHasHerbs && (
                      <span className="shrink-0 text-xs text-gray-400 font-semibold">
                        {group.herbs.length} herbal
                      </span>
                    )}
                  </div>

                  {group.mapping_info && (
                    <div className="flex items-start gap-3 bg-indigo-50/70 border border-indigo-100 p-4 rounded-2xl">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="text-xs text-indigo-700 italic leading-relaxed">
                        {group.mapping_info}
                      </p>
                    </div>
                  )}

                  {groupHasHerbs && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.herbs.map((herb, hi) => (
                        <div
                          key={hi}
                          onClick={() => onSelectHerb(herb, hasChemical)}
                          className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-primary-30 hover:shadow-md transition-all duration-200 flex cursor-pointer group/herb"
                        >
                          <div className="w-20 shrink-0 bg-gradient-to-b from-primary-10/50 to-green-50 flex items-center justify-center overflow-hidden">
                            {herb.image ? (
                              <img
                                src={herb.image}
                                alt={herb.name}
                                className="w-full h-full object-cover group-hover/herb:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.parentElement.innerHTML =
                                    '<span style="font-size:1.6rem">🌿</span>';
                                }}
                              />
                            ) : (
                              <span className="text-2xl">🌿</span>
                            )}
                          </div>
                          <div className="flex-1 p-3.5 min-w-0">
                            {(() => {
                              const clean = getCleanName(herb.name);
                              const primary = clean.split(",")[0].trim();
                              return (
                                <p
                                  className="text-sm font-extrabold text-gray-800 leading-snug line-clamp-1 group-hover/herb:text-primary-50 transition-colors mb-0.5"
                                  title={clean}
                                >
                                  {primary}
                                </p>
                              );
                            })()}
                            {herb.latin && (
                              <p className="text-xs text-gray-400 italic mb-1.5 truncate">
                                {herb.latin}
                              </p>
                            )}
                            {herb.part && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full font-semibold">
                                🍃 {herb.part}
                              </span>
                            )}
                            <p className="text-[10px] text-primary-40 font-bold mt-1.5 flex items-center gap-0.5">
                              Baca selengkapnya
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-3 w-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2.5}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Herbal Dihindari — desain identik dengan ResultSection ── */}
                  {groupHasUnsafe && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-sm font-black uppercase tracking-[0.2em] text-rose-600">
                            ⛔ Herbal yang Perlu Dihindari
                          </h4>
                          <p className="text-sm text-slate-500 mt-1">
                            Sistem mendeteksi {group.unsafe_herbs.length} herbal
                            yang berisiko untuk kategori ini.
                          </p>
                        </div>
                        <span className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-bold">
                          {group.unsafe_herbs.length} Risiko
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {group.unsafe_herbs.map((unsafe, ui) => (
                          <div
                            key={ui}
                            className="bg-white border border-rose-100 rounded-[24px] p-5 flex flex-col justify-between shadow-sm hover:border-rose-300 transition-all"
                          >
                            <div>
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-black uppercase rounded-md tracking-widest mb-3 inline-block">
                                Kategori: {group.group_name}
                              </span>
                              <h5 className="text-base font-black text-slate-800 mb-2">
                                {unsafe.name}
                              </h5>
                              <p className="text-[11px] text-rose-600 font-bold italic flex items-center gap-1.5 mb-4">
                                <AlertTriangle size={12} className="shrink-0" />
                                {unsafe.reason}
                              </p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUnsafe(unsafe);
                              }}
                              className="w-full py-2.5 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all shadow-md active:scale-95"
                            >
                              Lihat Analisis Risiko
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
// ─── Modal Konfirmasi Hapus ───────────────────────────────────────────────────
function DeleteModal({ hist, multiCount, onConfirm, onCancel, isDeleting }) {
  const isMulti = multiCount > 1;
  const allInputs = !isMulti
    ? [...(hist?.diagnoses || []), ...(hist?.symptoms || [])]
    : [];
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white rounded-[28px] shadow-2xl max-w-sm w-full p-8 animate-[slideUp_0.25s_ease-out]">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </div>
        <h3 className="text-lg font-extrabold text-gray-800 text-center mb-2">
          {isMulti ? `Hapus ${multiCount} Riwayat?` : "Hapus Riwayat?"}
        </h3>
        {isMulti ? (
          <p className="text-gray-400 text-sm text-center mb-6 leading-relaxed">
            <span className="font-bold text-red-500">{multiCount} riwayat</span>{" "}
            yang dipilih akan dihapus secara permanen.
          </p>
        ) : (
          <>
            <p className="text-gray-500 text-sm text-center mb-1 font-medium">
              {allInputs.length > 0 ? allInputs.join(", ") : "Analisis Umum"}
            </p>
            <p className="text-gray-400 text-xs text-center mb-6">
              {formatTanggalPendek(hist?.created_at)}
            </p>
          </>
        )}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold transition-colors text-sm"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className={`flex-1 px-4 py-3 rounded-2xl font-bold text-white text-sm transition-all bg-red-500 hover:bg-red-600 ${isDeleting ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isDeleting
              ? "Menghapus..."
              : isMulti
                ? `Hapus ${multiCount} Riwayat`
                : "Ya, Hapus"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Filter waktu helpers ─────────────────────────────────────────────────────
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

// ─── localStorage helpers ──────────────────────────────────────────────────────
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
  const [histories, setHistories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [timeFilter, setTimeFilter] = useState("semua");
  const [favorites, setFavorites] = useState(loadFavorites);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [selectedHerb, setSelectedHerb] = useState(null);
  const [selectedHerbChemical, setSelectedHerbChemical] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showMultiDeleteModal, setShowMultiDeleteModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const enterSelectMode = () => {
    setIsSelectMode(true);
    setSelectedIds(new Set());
  };
  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleToggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

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
      setHistories(await res.json());
    } catch {
      setError("Koneksi terputus. Pastikan server sedang berjalan.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchHistory();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchHistory]);
  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  const handleToggleFavorite = useCallback((histId) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(histId) ? next.delete(histId) : next.add(histId);
      saveFavorites(next);
      return next;
    });
  }, []);

  const filteredHistories = histories.filter((hist) => {
    const allInputs = [...(hist.diagnoses || []), ...(hist.symptoms || [])]
      .join(" ")
      .toLowerCase();
    const matchesSearch = allInputs.includes(searchTerm.toLowerCase());
    if (timeFilter === "favorit")
      return matchesSearch && favorites.has(hist.id);
    let matchesTime = true;
    if (timeFilter === "minggu")
      matchesTime = matchesPeriodFromToday(hist.created_at, 7);
    else if (timeFilter === "bulan")
      matchesTime = matchesPeriodFromToday(hist.created_at, 30);
    return matchesSearch && matchesTime;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredHistories.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedHistories = filteredHistories.slice(startIndex, endIndex);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, timeFilter]);

  const isAllSelected =
    paginatedHistories.length > 0 &&
    paginatedHistories.every((h) => selectedIds.has(h.id));

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const wallet = localStorage.getItem("user_wallet");
      const res = await fetch(
        `${API}/api/history/${deleteTarget.id}?wallet_address=${wallet}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Gagal menghapus riwayat.");
      setFavorites((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        saveFavorites(next);
        return next;
      });
      setHistories((prev) => prev.filter((h) => h.id !== deleteTarget.id));
      setNotification({
        type: "success",
        message: "Riwayat berhasil dihapus.",
      });
    } catch (err) {
      setNotification({ type: "error", message: err.message });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleMultiDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    const wallet = localStorage.getItem("user_wallet");
    const idsToDelete = [...selectedIds];
    let successCount = 0;
    const failedIds = [];
    await Promise.all(
      idsToDelete.map(async (id) => {
        try {
          const res = await fetch(
            `${API}/api/history/${id}?wallet_address=${wallet}`,
            { method: "DELETE" },
          );
          if (!res.ok) throw new Error();
          successCount++;
        } catch {
          failedIds.push(id);
        }
      }),
    );
    const deletedIds = idsToDelete.filter((id) => !failedIds.includes(id));
    setHistories((prev) => prev.filter((h) => !deletedIds.includes(h.id)));
    setFavorites((prev) => {
      const next = new Set(prev);
      deletedIds.forEach((id) => next.delete(id));
      saveFavorites(next);
      return next;
    });
    setIsDeleting(false);
    setShowMultiDeleteModal(false);
    exitSelectMode();
    failedIds.length === 0
      ? setNotification({
          type: "success",
          message: `${successCount} riwayat berhasil dihapus.`,
        })
      : setNotification({
          type: "error",
          message: `${successCount} berhasil, ${failedIds.length} gagal dihapus.`,
        });
  };

  const totalHerbsAll = histories.reduce(
    (s, h) =>
      s + (h.recommendations?.reduce((x, g) => x + g.herbs.length, 0) || 0),
    0,
  );
  const totalFavorites = histories.filter((h) => favorites.has(h.id)).length;
  const isFavoritTab = timeFilter === "favorit";

  return (
    <MainLayout>
      {deleteTarget && (
        <DeleteModal
          hist={deleteTarget}
          multiCount={1}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          isDeleting={isDeleting}
        />
      )}
      {showMultiDeleteModal && (
        <DeleteModal
          hist={null}
          multiCount={selectedIds.size}
          onConfirm={handleMultiDelete}
          onCancel={() => setShowMultiDeleteModal(false)}
          isDeleting={isDeleting}
        />
      )}

      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold animate-[slideUp_0.3s_ease-out] ${notification.type === "success" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}
        >
          {notification.type === "success" ? "✅ " : "❌ "}
          {notification.message}
        </div>
      )}

      <div className="absolute top-0 inset-x-0 h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-10/60 via-white to-transparent -z-10" />

      <div className="max-w-2xl mx-auto pt-14 md:pt-20 px-4 pb-32 min-h-[75vh]">
        {/* Header */}
        <div className="text-center mb-12 animate-[fadeIn_0.5s_ease-out]">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-white border border-gray-100 shadow-lg mb-5 hover:scale-105 transition-transform duration-300">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-primary-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 mb-3 tracking-tight">
            Riwayat{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-60 to-primary-40">
              Pencarian
            </span>
          </h1>
          <p className="text-gray-500 text-base max-w-sm mx-auto font-medium leading-relaxed">
            Semua hasil analisis herbal Anda tersimpan di sini.
          </p>

          {!isLoading && !error && histories.length > 0 && (
            <div className="inline-flex items-center gap-8 mt-7 px-8 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
              <div className="text-center">
                <p className="text-2xl font-extrabold text-gray-800">
                  {histories.length}
                </p>
                <p className="text-xs text-gray-400 font-semibold mt-0.5">
                  Total Riwayat
                </p>
              </div>
              <div className="w-px h-10 bg-gray-100"></div>
              <div className="text-center">
                <p className="text-2xl font-extrabold text-primary-50">
                  {totalHerbsAll}
                </p>
                <p className="text-xs text-gray-400 font-semibold mt-0.5">
                  Total Herbal
                </p>
              </div>
              <div className="w-px h-10 bg-gray-100"></div>
              <div className="text-center">
                <p className="text-2xl font-extrabold text-amber-500">
                  {totalFavorites}
                </p>
                <p className="text-xs text-gray-400 font-semibold mt-0.5">
                  ⭐ Favorit
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Filter Bar */}
        {!isLoading && !error && histories.length > 0 && (
          <div className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-2xl p-4 shadow-sm mb-10 flex flex-col sm:flex-row gap-3 animate-[slideDown_0.4s_ease-out]">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-gray-400">
                <svg
                  className="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Cari penyakit atau gejala..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-20 focus:border-primary-30 transition-all"
              />
            </div>
            <div className="flex gap-2 items-center">
              <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100 gap-1">
                {[
                  { id: "semua", label: "Semua" },
                  { id: "minggu", label: "Minggu Ini" },
                  { id: "bulan", label: "Bulan Ini" },
                  { id: "favorit", label: "⭐ Favorit" },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => setTimeFilter(btn.id)}
                    className={`flex-1 px-3 py-2 text-xs font-bold rounded-lg transition-all duration-200 whitespace-nowrap
                      ${
                        timeFilter === btn.id
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
              {!isSelectMode ? (
                <button
                  onClick={enterSelectMode}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-gray-50 hover:bg-red-50 border border-gray-100 hover:border-red-200 text-gray-500 hover:text-red-500 rounded-xl text-xs font-bold transition-all duration-200"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                  Pilih
                </button>
              ) : (
                <button
                  onClick={exitSelectMode}
                  className="shrink-0 px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold transition-all duration-200"
                >
                  Batal
                </button>
              )}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-36">
            <div className="relative w-12 h-12 mb-5">
              <div className="absolute inset-0 border-4 border-primary-10 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-primary-50 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <p className="text-gray-400 font-semibold text-sm">
              Memuat riwayat Anda...
            </p>
          </div>
        )}

        {!isLoading && error && (
          <div className="bg-white border border-red-100 rounded-[28px] p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-700 mb-2">
              Gagal Memuat
            </h3>
            <p className="text-gray-400 text-sm mb-6">{error}</p>
            <button
              onClick={fetchHistory}
              className="px-6 py-2.5 bg-primary-50 text-white rounded-full text-sm font-bold hover:bg-primary-60 transition-colors"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {!isLoading && !error && histories.length === 0 && (
          <div className="bg-white border-2 border-dashed border-gray-200 hover:border-primary-20 transition-colors rounded-[28px] p-16 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <span className="text-4xl">🌿</span>
            </div>
            <h3 className="text-xl font-extrabold text-gray-700 mb-2">
              Belum Ada Riwayat
            </h3>
            <p className="text-gray-400 text-sm mb-8 max-w-xs mx-auto leading-relaxed">
              Mulai analisis herbal pertama Anda dan hasilnya akan tersimpan
              otomatis di sini.
            </p>
            <a
              href="/home"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-50 hover:bg-primary-60 text-white rounded-full font-bold text-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary-20"
            >
              Mulai Analisis
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </a>
          </div>
        )}

        {!isLoading &&
          !error &&
          histories.length > 0 &&
          isFavoritTab &&
          filteredHistories.length === 0 && (
            <div className="bg-white border-2 border-dashed border-amber-100 hover:border-amber-200 transition-colors rounded-[28px] p-16 text-center">
              <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-9 w-9 text-amber-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-extrabold text-gray-700 mb-2">
                Belum ada riwayat favorit
              </h3>
              <p className="text-gray-400 text-sm max-w-xs mx-auto leading-relaxed">
                Tandai riwayat pencarian dengan ⭐ untuk menyimpannya di sini.
              </p>
            </div>
          )}

        {!isLoading &&
          !error &&
          histories.length > 0 &&
          !isFavoritTab &&
          filteredHistories.length === 0 && (
            <div className="bg-white border border-gray-100 rounded-[28px] p-12 text-center shadow-sm">
              <span className="text-4xl mb-4 block">🔍</span>
              <h4 className="text-base font-bold text-gray-700 mb-2">
                Tidak Ditemukan
              </h4>
              <p className="text-gray-400 text-sm mb-5">
                Tidak ada riwayat yang cocok dengan pencarian Anda.
              </p>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setTimeFilter("semua");
                }}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full text-sm font-bold transition-colors"
              >
                Reset Filter
              </button>
            </div>
          )}

        {!isLoading && !error && filteredHistories.length > 0 && (
          <>
            <div className="space-y-4">
              {paginatedHistories.map((hist, index) => (
                <RiwayatCard
                  key={hist.id}
                  hist={hist}
                  index={index}
                  onDelete={setDeleteTarget}
                  onSelectHerb={(herb, chemical) => {
                    setSelectedHerb(herb);
                    setSelectedHerbChemical(!!chemical);
                  }}
                  isFavorite={favorites.has(hist.id)}
                  onToggleFavorite={handleToggleFavorite}
                  isSelectMode={isSelectMode}
                  isSelected={selectedIds.has(hist.id)}
                  onToggleSelect={handleToggleSelect}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50 border border-gray-100 rounded-2xl p-4 shadow-sm animate-[slideUp_0.3s_ease-out]">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                    currentPage === 1
                      ? "bg-white text-gray-300 cursor-not-allowed border border-gray-200"
                      : "bg-white text-gray-600 hover:bg-primary-10 hover:text-primary-50 border border-gray-200 hover:border-primary-30"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Sebelumnya
                </button>

                <div className="flex flex-col sm:flex-row items-center gap-2 text-center">
                  <span className="text-sm font-medium text-gray-600">
                    Halaman{" "}
                    <span className="font-bold text-primary-50">
                      {currentPage}
                    </span>{" "}
                    dari{" "}
                    <span className="font-bold">
                      {totalPages}
                    </span>
                  </span>
                  <div className="hidden sm:block h-6 w-px bg-gray-200"></div>
                  <span className="text-xs text-gray-400 font-medium">
                    Menampilkan {startIndex + 1}–
                    {Math.min(endIndex, filteredHistories.length)} dari{" "}
                    {filteredHistories.length}
                  </span>
                </div>

                <button
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={currentPage === totalPages}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                    currentPage === totalPages
                      ? "bg-white text-gray-300 cursor-not-allowed border border-gray-200"
                      : "bg-white text-gray-600 hover:bg-primary-10 hover:text-primary-50 border border-gray-200 hover:border-primary-30"
                  }`}
                >
                  Selanjutnya
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Action Bar */}
      {isSelectMode && (
        <div className="fixed bottom-6 inset-x-0 flex justify-center px-4 z-40 pointer-events-none animate-[slideUp_0.3s_ease-out]">
          <div className="pointer-events-auto bg-white border border-gray-200 rounded-[28px] shadow-2xl shadow-black/10 px-4 py-3 flex items-center gap-3 max-w-lg w-full">
            <button
              onClick={
                isAllSelected
                  ? () => setSelectedIds(new Set())
                  : () =>
                      setSelectedIds(
                        new Set(paginatedHistories.map((h) => h.id)),
                      )
              }
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 ${isAllSelected ? "bg-primary-10 text-primary-50 hover:bg-primary-20" : "bg-gray-50 border border-gray-100 text-gray-500 hover:bg-gray-100"}`}
            >
              <div
                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${isAllSelected ? "bg-primary-50 border-primary-50" : "border-gray-300"}`}
              >
                {isAllSelected && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-2.5 w-2.5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
              {isAllSelected ? "Batal Semua" : "Pilih Semua"}
            </button>
            <div className="flex-1 text-center">
              {selectedIds.size === 0 ? (
                <p className="text-xs text-gray-400 font-semibold">
                  Belum ada yang dipilih
                </p>
              ) : (
                <p className="text-sm font-extrabold text-gray-800">
                  <span className="text-red-500">{selectedIds.size}</span>{" "}
                  dipilih
                </p>
              )}
            </div>
            <button
              onClick={() => {
                if (selectedIds.size > 0) setShowMultiDeleteModal(true);
              }}
              disabled={selectedIds.size === 0}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-extrabold text-white transition-all duration-200 ${selectedIds.size > 0 ? "bg-red-500 hover:bg-red-600 shadow-sm hover:shadow-md hover:shadow-red-200" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Hapus{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </button>
          </div>
        </div>
      )}

      {selectedHerb && (
        <HerbDetailModal
          herb={selectedHerb}
          onClose={() => {
            setSelectedHerb(null);
            setSelectedHerbChemical(false);
          }}
          showMedicalWarning={selectedHerbChemical}
        />
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
