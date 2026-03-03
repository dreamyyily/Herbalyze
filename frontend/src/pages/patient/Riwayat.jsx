import { useState, useEffect, useCallback } from "react";
import MainLayout from "../../layouts/MainLayout";
import ResultSection from "../../components/ResultSection";
import { saveHistoryToBlockchain } from "../../utils/web3";

// ============================================================
// IKON BLOCKCHAIN (SVG Inline agar tidak perlu library baru)
// ============================================================
const BlockchainIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ChainBadge = () => (
  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-violet-50 to-purple-100 border border-purple-200/80 text-purple-700 text-xs font-bold shadow-sm shrink-0">
    <BlockchainIcon className="h-3.5 w-3.5" />
    🛡️ Aman & Permanen
  </span>
);

// ============================================================
// MODAL KONFIRMASI HAPUS
// ============================================================
function DeleteModal({ hist, onConfirm, onCancel, isDeleting }) {
  const isAmanPermanen = hist?.is_on_blockchain;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white rounded-[32px] shadow-2xl max-w-md w-full p-8 animate-[slideUp_0.3s_ease-out]">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${isAmanPermanen ? 'bg-violet-100' : 'bg-red-50'}`}>
          {isAmanPermanen ? (
            <BlockchainIcon className="h-8 w-8 text-violet-600" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
        </div>
        <h3 className="text-xl font-extrabold text-dark-50 text-center mb-3">
          {isAmanPermanen ? "Sembunyikan dari Tampilan?" : "Hapus Riwayat?"}
        </h3>
        {isAmanPermanen ? (
          <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 mb-6">
            <p className="text-violet-800 text-sm font-medium text-center leading-relaxed">
              Riwayat ini sudah <strong>tersimpan permanen dan aman</strong> — tidak bisa dihapus siapapun.
              Kamu hanya bisa menyembunyikannya dari tampilan aplikasi.
            </p>
          </div>
        ) : (
          <p className="text-dark-30 text-center text-sm font-medium mb-6 leading-relaxed">
            Riwayat ini akan disembunyikan dari tampilan. Jika ingin menyimpannya selamanya, klik <strong>"Simpan Permanen"</strong> terlebih dahulu.
          </p>
        )}
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting} className="flex-1 px-6 py-3 bg-light-20 hover:bg-light-40 text-dark-50 rounded-2xl font-bold transition-colors">
            Batal
          </button>
          <button onClick={onConfirm} disabled={isDeleting} className={`flex-1 px-6 py-3 rounded-2xl font-bold text-white transition-all ${isAmanPermanen ? 'bg-violet-600 hover:bg-violet-700' : 'bg-red-500 hover:bg-red-600'} ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {isDeleting ? "Menyembunyikan..." : "Ya, Sembunyikan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MODAL KONFIRMASI SIMPAN KE BLOCKCHAIN
// ============================================================
function SaveBlockchainModal({ hist, onConfirm, onCancel, isSaving }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white rounded-[32px] shadow-2xl max-w-md w-full p-8 animate-[slideUp_0.3s_ease-out]">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-100 to-purple-200 flex items-center justify-center mx-auto mb-5">
          <span className="text-3xl">🛡️</span>
        </div>
        <h3 className="text-xl font-extrabold text-dark-50 text-center mb-2">Simpan Permanen?</h3>
        <p className="text-dark-30 text-center text-sm font-medium mb-5 leading-relaxed">
          Riwayat ini akan <strong>disimpan selamanya dan dilindungi</strong> — tidak bisa diubah atau dihapus oleh siapapun, termasuk dokter dan admin.
        </p>
        <div className="bg-violet-50 rounded-2xl p-4 mb-4 border border-violet-100">
          <p className="text-violet-700 text-xs font-bold uppercase tracking-widest mb-2">Riwayat yang akan diamankan</p>
          <p className="text-dark-50 text-sm font-semibold">
            {[...(hist?.diagnoses || []), ...(hist?.symptoms || [])].join(", ") || "Analisis Umum"}
          </p>
          <p className="text-dark-30 text-xs mt-1">{(hist?.recommendations || []).reduce((s, g) => s + g.herbs.length, 0)} rekomendasi herbal</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-6">
          <p className="text-amber-700 text-xs font-medium text-center">📱 Pastikan MetaMask kamu aktif dan terhubung</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isSaving} className="flex-1 px-6 py-3 bg-light-20 hover:bg-light-40 text-dark-50 rounded-2xl font-bold transition-colors">
            Batal
          </button>
          <button onClick={onConfirm} disabled={isSaving} className={`flex-1 px-6 py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 transition-all ${isSaving ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-purple-200'}`}>
            {isSaving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Sedang Mengamankan...
              </span>
            ) : "🛡️ Ya, Simpan Permanen"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// KOMPONEN UTAMA
// ============================================================
export default function Riwayat() {
  // STATE MANAGEMENT
  const [histories, setHistories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeHistory, setActiveHistory] = useState(null);

  // Filter & Search States
  const [searchTerm, setSearchTerm] = useState("");
  const [timeFilter, setTimeFilter] = useState("semua");
  const [blockchainFilter, setBlockchainFilter] = useState("semua"); // "semua" | "blockchain" | "lokal"

  // Modal States
  const [deleteTarget, setDeleteTarget] = useState(null);  // hist yang mau dihapus
  const [saveTarget, setSaveTarget] = useState(null);      // hist yang mau disimpan ke blockchain
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState(null);  // { type: 'success'|'error', message }

  // DATA FETCHING
  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const wallet = localStorage.getItem("user_wallet");
    if (!wallet) {
      setError("Autentikasi diperlukan. Silakan hubungkan dompet (wallet) Anda.");
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch(`http://localhost:8000/api/history/${wallet}`);
      if (!res.ok) throw new Error("Gagal melakukan sinkronisasi dengan server.");
      const data = await res.json();
      setHistories(data);
    } catch (err) {
      setError("Koneksi terputus. Pastikan server backend Anda sedang berjalan.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // NOTIFIKASI OTOMATIS HILANG
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // UTILITAS
  const formatTanggal = (isoString) => {
    if (!isoString) return "Waktu tidak terdata";
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(isoString));
  };

  // FILTER ENGINE
  const filteredHistories = histories.filter((hist) => {
    const allInputs = [...(hist.diagnoses || []), ...(hist.symptoms || [])].join(" ").toLowerCase();
    const matchesSearch = allInputs.includes(searchTerm.toLowerCase());

    let matchesTime = true;
    if (timeFilter !== "semua" && hist.created_at) {
      const diffDays = Math.ceil(Math.abs(new Date() - new Date(hist.created_at)) / (1000 * 60 * 60 * 24));
      if (timeFilter === "7hari") matchesTime = diffDays <= 7;
      if (timeFilter === "30hari") matchesTime = diffDays <= 30;
    }

    let matchesBlockchain = true;
    if (blockchainFilter === "blockchain") matchesBlockchain = hist.is_on_blockchain === true;
    if (blockchainFilter === "lokal") matchesBlockchain = !hist.is_on_blockchain;

    return matchesSearch && matchesTime && matchesBlockchain;
  });

  // HANDLER: SIMPAN KE BLOCKCHAIN
  const handleSaveToBlockchain = async () => {
    if (!saveTarget) return;
    setIsSaving(true);
    try {
      // Ambil wallet dari MetaMask langsung (bukan localStorage) untuk pastikan format benar
      let wallet = null;
      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        wallet = accounts?.[0]; // Sudah dalam format checksum dari MetaMask
      }
      // Fallback ke localStorage jika MetaMask tidak tersedia
      if (!wallet) {
        wallet = localStorage.getItem("user_wallet");
      }
      if (!wallet) throw new Error("Wallet tidak terdeteksi. Pastikan MetaMask terhubung dan unlock.");

      // 1. Kirim ke blockchain via MetaMask
      const { txHash, recordId } = await saveHistoryToBlockchain(wallet, saveTarget);

      // 2. Update database backend dengan tx_hash
      const res = await fetch("http://localhost:8000/api/history/save-to-blockchain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history_id: saveTarget.id,
          tx_hash: txHash,
          record_id: recordId,
        }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan hash ke server.");

      // 3. Update state lokal (tidak perlu refetch)
      setHistories((prev) =>
        prev.map((h) =>
          h.id === saveTarget.id
            ? { ...h, is_on_blockchain: true, blockchain_tx_hash: txHash, blockchain_record_id: recordId }
            : h
        )
      );
      setNotification({ type: "success", message: `Berhasil disematkan ke blockchain! TX: ${txHash.slice(0, 20)}...` });
    } catch (err) {
      console.error("Save to blockchain error:", err);
      const msg = err.code === 4001 ? "Transaksi dibatalkan oleh pengguna." : err.message || "Gagal menyimpan ke blockchain.";
      setNotification({ type: "error", message: `Gagal: ${msg}` });
    } finally {
      setIsSaving(false);
      setSaveTarget(null);
    }
  };

  // HANDLER: SOFT DELETE
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const wallet = localStorage.getItem("user_wallet");
      const res = await fetch(`http://localhost:8000/api/history/${deleteTarget.id}?wallet_address=${wallet}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Gagal menghapus riwayat.");

      setHistories((prev) => prev.filter((h) => h.id !== deleteTarget.id));
      setNotification({ type: "success", message: "🗑️ Riwayat berhasil disembunyikan dari tampilan." });
    } catch (err) {
      setNotification({ type: "error", message: `❌ ${err.message}` });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  // ============================================================
  // RENDER VIEW 1: MODE DETAIL
  // ============================================================
  if (activeHistory) {
    return (
      <MainLayout>
        <div className="absolute top-0 inset-x-0 h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-10/70 via-light-10 to-transparent -z-10 animate-[fadeIn_1s_ease-out]" />
        <div className="max-w-6xl mx-auto pt-10 md:pt-14 px-4 pb-24 animate-[slideUp_0.4s_ease-out]">

          {/* Back Button */}
          <button
            onClick={() => setActiveHistory(null)}
            className="group mb-8 inline-flex items-center gap-2.5 px-6 py-2.5 bg-white/80 backdrop-blur-md border border-light-40 rounded-full text-dark-40 hover:text-primary-50 hover:border-primary-30 hover:shadow-lg transition-all duration-300 font-bold text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:-translate-x-1.5 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Kembali ke Daftar Riwayat
          </button>

          {/* Rekap Header Info */}
          <div className="bg-gradient-to-br from-white to-primary-10/30 border border-primary-20/60 rounded-[32px] p-6 md:p-8 mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-40/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
            <div className="relative z-10">
              <p className="text-primary-50 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary-40 animate-[pulse_2s_ease-in-out_infinite] shadow-[0_0_8px_rgba(37,99,235,0.6)]"></span>
                Dokumen Rekam Medis
              </p>
              <h3 className="text-2xl md:text-3xl font-extrabold text-dark-50 tracking-tight">{formatTanggal(activeHistory.created_at)}</h3>
            </div>
            <div className="flex flex-wrap gap-3 relative z-10">
              {/* Blockchain Badge di detail */}
              {activeHistory.is_on_blockchain && (
                <div className="flex flex-col gap-1">
                  <ChainBadge />
                  {activeHistory.blockchain_tx_hash && (
                    <p className="text-purple-500 text-xs font-mono text-right">
                      Kode Bukti: {activeHistory.blockchain_tx_hash.slice(0, 12)}...
                    </p>
                  )}
                </div>
              )}
              {activeHistory.special_conditions?.length > 0 && activeHistory.special_conditions[0] !== "Tidak ada" && (
                <span className="px-4 py-2 bg-gradient-to-r from-amber-50 to-amber-100/50 text-amber-700 border border-amber-200/60 rounded-full text-sm font-bold shadow-sm flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  {activeHistory.special_conditions.join(", ")}
                </span>
              )}
              {activeHistory.chemical_drugs?.includes("Ya") && (
                <span className="px-4 py-2 bg-gradient-to-r from-danger-30/10 to-danger-30/5 text-danger-30 border border-danger-30/20 rounded-full text-sm font-bold shadow-sm">
                  Mengonsumsi Obat Kimia
                </span>
              )}
            </div>
          </div>

          {/* Injeksi Komponen AI Result */}
          <ResultSection recommendations={activeHistory.recommendations} selectedDrug={activeHistory.chemical_drugs} />
        </div>
      </MainLayout>
    );
  }

  // ============================================================
  // RENDER VIEW 2: MODE MASTER LIST
  // ============================================================
  const blockchainCount = histories.filter(h => h.is_on_blockchain).length;

  return (
    <MainLayout>
      {/* Modals */}
      {deleteTarget && (
        <DeleteModal hist={deleteTarget} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} isDeleting={isDeleting} />
      )}
      {saveTarget && (
        <SaveBlockchainModal hist={saveTarget} onConfirm={handleSaveToBlockchain} onCancel={() => setSaveTarget(null)} isSaving={isSaving} />
      )}

      {/* Notifikasi */}
      {notification && (
        <div className={`fixed bottom-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-2xl font-semibold text-sm max-w-sm animate-[slideUp_0.3s_ease-out] ${notification.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {notification.message}
        </div>
      )}

      <div className="absolute top-0 inset-x-0 h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-10/80 via-light-10 to-transparent -z-10" />

      <div className="max-w-4xl mx-auto pt-10 md:pt-14 px-4 pb-28 min-h-[75vh]">

        {/* PAGE HEADER */}
        <div className="text-center mb-10 animate-[fadeIn_0.5s_ease-out]">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[28px] bg-white text-primary-50 mb-6 shadow-[0_15px_40px_rgba(37,99,235,0.15)] border border-primary-10/50 -rotate-3 hover:rotate-0 transition-transform duration-500 ease-out">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-dark-50 mb-4 tracking-tight leading-tight">
            Riwayat <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-60 to-primary-40">Kesehatan</span>
          </h1>
          <p className="text-dark-30 text-lg md:text-xl max-w-2xl mx-auto font-medium">Rekam jejak pintar analisis kondisi medis dan kumpulan resep herbal Anda.</p>

          {/* Stats Keamanan */}
          {!isLoading && !error && histories.length > 0 && blockchainCount > 0 && (
            <div className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-violet-50 border border-violet-200 rounded-full">
              <span>🛡️</span>
              <span className="text-violet-700 text-sm font-bold">{blockchainCount} dari {histories.length} riwayat sudah aman & tersimpan permanen</span>
            </div>
          )}
        </div>

        {/* CONTROL PANEL */}
        {!isLoading && !error && histories.length > 0 && (
          <div className="sticky top-24 z-30 bg-white/70 backdrop-blur-xl rounded-[28px] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-white/50 mb-10 flex flex-col gap-4 animate-[slideDown_0.6s_ease-out_forwards]">

            {/* Row 1: Search */}
            <div className="relative w-full group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-dark-20 group-focus-within:text-primary-50 transition-colors">
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
              </div>
              <input
                type="text"
                placeholder="Cari nama penyakit atau gejala..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-11 pr-4 py-3.5 border border-light-40 rounded-2xl bg-light-10/50 placeholder-dark-20 text-dark-50 font-medium focus:outline-none focus:bg-white focus:ring-4 focus:ring-primary-10 focus:border-primary-40 transition-all duration-300"
              />
            </div>

            {/* Row 2: Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Filter Waktu */}
              <div className="flex bg-light-20/60 p-1.5 rounded-2xl flex-1 border border-light-40">
                {[{ id: "semua", label: "Semua Waktu" }, { id: "7hari", label: "7 Hari" }, { id: "30hari", label: "30 Hari" }].map((btn) => (
                  <button key={btn.id} onClick={() => setTimeFilter(btn.id)}
                    className={`flex-1 px-4 py-2.5 text-xs font-extrabold rounded-xl transition-all duration-300 whitespace-nowrap ${timeFilter === btn.id ? "bg-white text-primary-50 shadow-md" : "text-dark-30 hover:text-dark-50"}`}>
                    {btn.label}
                  </button>
                ))}
              </div>

              {/* Filter Keamanan */}
              <div className="flex bg-light-20/60 p-1.5 rounded-2xl flex-1 border border-light-40">
                {[
                  { id: "semua", label: "📋 Semua" },
                  { id: "blockchain", label: "🛡️ Aman & Permanen" },
                  { id: "lokal", label: "📝 Belum Diamankan" },
                ].map((btn) => (
                  <button key={btn.id} onClick={() => setBlockchainFilter(btn.id)}
                    className={`flex-1 px-4 py-2.5 text-xs font-extrabold rounded-xl transition-all duration-300 whitespace-nowrap ${blockchainFilter === btn.id ? "bg-white text-purple-600 shadow-md" : "text-dark-30 hover:text-dark-50"}`}>
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STATE: LOADING */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-32 animate-pulse">
            <div className="relative w-16 h-16 mb-6">
              <div className="absolute inset-0 border-4 border-primary-10 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-primary-50 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <p className="text-dark-30 font-bold tracking-wide">Membuka brankas medis digital...</p>
          </div>
        )}

        {/* STATE: ERROR */}
        {!isLoading && error && (
          <div className="bg-gradient-to-b from-white to-danger-30/5 border border-danger-30/20 rounded-[40px] p-12 text-center max-w-2xl mx-auto shadow-2xl">
            <div className="w-24 h-24 bg-danger-30/10 rounded-full flex items-center justify-center mx-auto mb-6 text-danger-30">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h3 className="text-3xl font-extrabold text-dark-50 mb-4 tracking-tight">Koneksi Terputus</h3>
            <p className="text-dark-40 text-lg font-medium">{error}</p>
          </div>
        )}

        {/* STATE: EMPTY */}
        {!isLoading && !error && histories.length === 0 && (
          <div className="bg-white/60 backdrop-blur-sm border-2 border-dashed border-light-40 hover:border-primary-30 transition-colors duration-500 rounded-[40px] p-16 text-center max-w-2xl mx-auto">
            <div className="w-28 h-28 bg-gradient-to-tr from-light-20 to-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-dark-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <h3 className="text-3xl font-extrabold text-dark-50 mb-4 tracking-tight">Belum Ada Catatan</h3>
            <p className="text-dark-30 text-lg mb-10 font-medium max-w-md mx-auto">Riwayat Anda masih kosong. Mari mulai dengan menemukan solusi herbal cerdas untuk keluhan Anda hari ini.</p>
            <a href="/home" className="inline-flex items-center gap-3 px-8 py-4 bg-primary-50 hover:bg-primary-60 text-white rounded-full font-bold transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_15px_30px_rgba(37,99,235,0.3)]">
              Mulai Analisis Baru
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </a>
          </div>
        )}

        {/* STATE: NOT FOUND (Filter tidak cocok) */}
        {!isLoading && !error && histories.length > 0 && filteredHistories.length === 0 && (
          <div className="text-center py-20 bg-white/50 backdrop-blur-sm rounded-[32px] border border-light-40">
            <span className="text-6xl mb-4 block">🔍</span>
            <h4 className="text-xl font-bold text-dark-40 mb-2">Pencarian Tidak Ditemukan</h4>
            <p className="text-dark-30 font-medium mb-6">Tidak ada riwayat yang cocok dengan filter Anda.</p>
            <button onClick={() => { setSearchTerm(""); setTimeFilter("semua"); setBlockchainFilter("semua"); }} className="px-6 py-2.5 bg-light-20 hover:bg-light-40 text-dark-50 rounded-full font-bold transition-colors">
              Reset Semua Filter
            </button>
          </div>
        )}

        {/* DATA TERSEDIA: TIMELINE CARDS */}
        {!isLoading && !error && filteredHistories.length > 0 && (
          <div className="space-y-6 relative before:absolute before:inset-y-6 before:left-[27px] before:w-1 before:bg-gradient-to-b before:from-primary-40/60 before:via-light-40 before:to-transparent hidden sm:block sm:before:block">
            {filteredHistories.map((hist, index) => {
              const totalHerbs = hist.recommendations?.reduce((sum, group) => sum + group.herbs.length, 0) || 0;
              const allInputs = [...(hist.diagnoses || []), ...(hist.symptoms || [])];
              const isOnChain = hist.is_on_blockchain;

              return (
                <div key={hist.id} className="relative sm:pl-[72px] animate-[staggeredFadeIn_0.6s_ease-out_forwards]" style={{ opacity: 0, animationDelay: `${index * 120}ms` }}>
                  {/* Titik Timeline */}
                  <div className="hidden sm:block absolute left-5 top-8 z-10">
                    <div className={`absolute inset-0 w-4 h-4 rounded-full animate-ping opacity-75 ${isOnChain ? 'bg-violet-400' : 'bg-primary-40'}`}></div>
                    <div className={`relative w-4 h-4 rounded-full border-[3px] border-white shadow-lg ${isOnChain ? 'bg-violet-600 shadow-violet-200' : 'bg-primary-50 shadow-blue-200'}`}></div>
                  </div>

                  {/* KARTU */}
                  <div className={`group bg-white rounded-[32px] border p-6 md:p-8 shadow-sm hover:shadow-[0_20px_40px_rgba(37,99,235,0.12)] hover:-translate-y-1.5 transition-all duration-500 relative overflow-hidden ${isOnChain ? 'border-violet-200/60 hover:border-violet-300' : 'border-light-40 hover:border-primary-30/80'}`}>

                    {/* Shimmer hover effect */}
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none ${isOnChain ? 'bg-gradient-to-tr from-violet-50/0 via-transparent to-purple-50/60' : 'bg-gradient-to-tr from-primary-10/0 via-transparent to-primary-10/40'}`}></div>

                    {/* Strip "Aman & Permanen" di pojok kanan atas */}
                    {isOnChain && (
                      <div className="absolute top-0 right-0 bg-gradient-to-bl from-violet-600 to-purple-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-bl-2xl rounded-tr-[32px] flex items-center gap-1">
                        🛡️ AMAN & PERMANEN
                      </div>
                    )}

                    <div className="relative z-10">
                      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6 mb-6">
                        {/* Kiri: Waktu & Penyakit */}
                        <div className="flex-1 pr-4">
                          <p className="text-xs font-bold text-primary-50 uppercase tracking-[0.15em] mb-2 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            {formatTanggal(hist.created_at)}
                          </p>
                          <h3 className="text-lg md:text-xl font-extrabold text-dark-50 leading-snug group-hover:text-primary-60 transition-colors duration-300">
                            {allInputs.length > 0 ? allInputs.join(", ") : "Analisis Umum"}
                          </h3>
                        </div>

                        {/* Kanan: Badges */}
                        <div className="flex flex-wrap items-center gap-2.5 xl:justify-end shrink-0">
                          {isOnChain && <ChainBadge />}
                          {hist.special_conditions?.length > 0 && hist.special_conditions[0] !== "Tidak ada" && (
                            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200/80 text-amber-700 text-xs font-bold shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              {hist.special_conditions.join(", ")}
                            </span>
                          )}
                          {hist.chemical_drugs?.includes("Ya") && (
                            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-danger-30/10 border border-danger-30/20 text-danger-30 text-xs font-bold shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-danger-30"></span>
                              Obat Kimia
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-light-10 text-dark-40 rounded-full text-xs font-extrabold border border-light-40">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 2a1 1 0 00-.707 1.707L7 4.414v3.758a1 1 0 01-.293.707l-4 4C.817 14.769 2.156 18 4.828 18h10.343c2.673 0 4.012-3.231 2.122-5.121l-4-4A1 1 0 0113 8.172V4.414l.707-.707A1 1 0 0013 2H7zm2 6.172V4h2v4.172a3 3 0 00.879 2.12l1.027 1.028a4 4 0 00-2.171.102l-.47.156a4 4 0 01-2.53 0l-.563-.187a1.993 1.993 0 00-.114-.035l1.063-1.063A3 3 0 009 8.172z" clipRule="evenodd" /></svg>
                            {totalHerbs} Herbal
                          </span>
                        </div>
                      </div>

                      {/* Kode Bukti Keamanan */}
                      {isOnChain && hist.blockchain_tx_hash && (
                        <div className="mb-4 px-4 py-2.5 bg-violet-50/80 border border-violet-100 rounded-2xl flex items-center gap-2.5">
                          <span className="text-violet-500 shrink-0">🛡️</span>
                          <div>
                            <p className="text-violet-500 text-[10px] font-bold uppercase tracking-widest">Kode Bukti Keamanan</p>
                            <span className="text-violet-600 text-xs font-mono truncate">{hist.blockchain_tx_hash}</span>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center justify-between pt-5 border-t border-light-40/60 mt-2 gap-3">
                        {/* Buka Detail */}
                        <button
                          onClick={() => setActiveHistory(hist)}
                          className="inline-flex items-center justify-center gap-2.5 px-7 py-3 rounded-full bg-light-10 group-hover:bg-primary-50 text-dark-40 group-hover:text-white text-sm font-extrabold transition-all duration-500"
                        >
                          Buka Rekam Medis
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:translate-x-1.5 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </button>

                        <div className="flex items-center gap-2">
                          {/* Tombol Simpan Permanen (hanya jika belum diamankan) */}
                          {!isOnChain && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setSaveTarget(hist); }}
                              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-violet-50 hover:bg-violet-600 text-violet-700 hover:text-white border border-violet-200 hover:border-violet-600 text-xs font-bold transition-all duration-300"
                            >
                              🛡️ Simpan Permanen
                            </button>
                          )}

                          {/* Tombol Hapus */}
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(hist); }}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-red-50 hover:bg-red-500 text-red-500 hover:text-white border border-red-100 hover:border-red-500 text-xs font-bold transition-all duration-300"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Hapus
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes staggeredFadeIn { from { opacity: 0; transform: translateY(40px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </MainLayout>
  );
}