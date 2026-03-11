import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../../layouts/MainLayout";
import CryptoJS from "crypto-js";
import { ethers } from "ethers";
import { getReadOnlyContract, getSignerContract } from "../../utils/web3";
import Avatar from "../../components/Avatar";

const API = "http://localhost:8000";

// ─── Toast Component ────────────────────────────────────────────────────────
function Toast({ toasts, removeToast }) {
  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 px-5 py-4 rounded-2xl shadow-2xl border backdrop-blur-sm max-w-sm w-full
            transform transition-all duration-500 animate-slide-in
            ${t.type === "success" ? "bg-white border-green-200 text-green-800" :
              t.type === "error"   ? "bg-white border-red-200 text-red-800" :
              t.type === "warning" ? "bg-white border-orange-200 text-orange-800" :
                                     "bg-white border-blue-200 text-blue-800"}`}
        >
          <span className="text-2xl mt-0.5 flex-shrink-0">
            {t.type === "success" ? "✅" : t.type === "error" ? "❌" : t.type === "warning" ? "⚠️" : "ℹ️"}
          </span>
          <div className="flex-1">
            {t.title && <p className="font-bold text-sm mb-0.5">{t.title}</p>}
            <p className="text-sm leading-relaxed">{t.message}</p>
            {t.sub && <p className="text-xs mt-1 opacity-70 break-all">{t.sub}</p>}
          </div>
          <button
            onClick={() => removeToast(t.id)}
            className="text-gray-300 hover:text-gray-500 text-lg leading-none flex-shrink-0 mt-0.5"
          >×</button>
        </div>
      ))}
    </div>
  );
}

// ─── Confirm Modal Component ─────────────────────────────────────────────────
function ConfirmModal({ modal, onConfirm, onCancel }) {
  if (!modal) return null;
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 transform animate-scale-in">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-5
          ${modal.type === "danger" ? "bg-red-50" : "bg-blue-50"}`}>
          {modal.icon || (modal.type === "danger" ? "🗑️" : "❓")}
        </div>
        <h3 className="text-xl font-bold text-gray-800 text-center mb-2">{modal.title}</h3>
        <p className="text-gray-500 text-center text-sm leading-relaxed mb-2">{modal.message}</p>
        {modal.sub && (
          <p className="text-xs text-gray-400 text-center bg-gray-50 rounded-xl p-3 mb-2">{modal.sub}</p>
        )}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 rounded-2xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
          >
            {modal.cancelText || "Batal"}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3.5 rounded-2xl font-bold text-white transition-all shadow-lg active:scale-95
              ${modal.type === "danger"
                ? "bg-red-500 hover:bg-red-600 shadow-red-200"
                : "bg-primary-40 hover:bg-primary-50 shadow-primary-100"}`}
          >
            {modal.confirmText || "Ya"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Loading Overlay ─────────────────────────────────────────────────────────
function LoadingOverlay({ show, message }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl shadow-2xl px-10 py-8 flex flex-col items-center gap-5 max-w-xs w-full">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-primary-40/20 border-t-primary-40 animate-spin" />
          <span className="absolute inset-0 flex items-center justify-center text-2xl">⛓️</span>
        </div>
        <div className="text-center">
          <p className="font-bold text-gray-800 mb-1">Memproses</p>
          <p className="text-sm text-gray-500">{message || "Mohon tunggu..."}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function CatatanDokter() {
  const userWallet = (localStorage.getItem('user_wallet') || '').toLowerCase();
  const navigate = useNavigate();

  // ── State: rekam medis dari blockchain ──
  const [records, setRecords] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);

  // ── State: draft pending dari DB ──
  const [pendingDrafts, setPendingDrafts] = useState([]);
  const [isFetchingDrafts, setIsFetchingDrafts] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [isProcessingDraft, setIsProcessingDraft] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");

  // ── State: tab aktif ──
  const [activeTab, setActiveTab] = useState("draft");

  // ── Toast system ──
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((type, title, message, sub = "", duration = 5000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, title, message, sub }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  // ── Confirm modal system ──
  const [modal, setModal] = useState(null);
  const showModal = (config) => new Promise((resolve) => {
    setModal({ ...config, resolve });
  });
  const handleModalConfirm = () => { if (modal?.resolve) modal.resolve(true); setModal(null); };
  const handleModalCancel = () => { if (modal?.resolve) modal.resolve(false); setModal(null); };

  // ── Polling draft pending ──
  const fetchPendingDrafts = useCallback(async () => {
    if (!userWallet) return;
    setIsFetchingDrafts(true);
    try {
      const res = await fetch(`${API}/api/medical-record/draft/pending/${userWallet}`);
      if (!res.ok) return;
      const data = await res.json();
      setPendingDrafts(data.drafts || []);
    } catch (err) {
      console.warn("Gagal polling draft:", err);
    } finally {
      setIsFetchingDrafts(false);
    }
  }, [userWallet]);

  useEffect(() => {
    if (userWallet) {
      fetchPendingDrafts();
      fetchRecordsFromBlockchain();
    }
    const interval = setInterval(fetchPendingDrafts, 30000);
    return () => clearInterval(interval);
  }, [userWallet, fetchPendingDrafts]);

  // ── Fetch rekam medis dari blockchain ──
  const fetchRecordsFromBlockchain = async () => {
    if (!userWallet) return;
    setIsFetching(true);
    try {
      const contract = getReadOnlyContract();
      const totalCount = await contract.recordCount();
      const total = totalCount.toNumber();
      if (total === 0) { setRecords([]); return; }

      const myRecords = [];
      for (let i = 1; i <= total; i++) {
        try {
          const [encryptedData, patientAddress, uploader, timestamp] = await contract.getMedicalRecord(i);
          if (patientAddress.toLowerCase() !== userWallet) continue;
          try {
            const bytes = CryptoJS.AES.decrypt(encryptedData, userWallet);
            const plain = bytes.toString(CryptoJS.enc.Utf8);
            if (!plain) continue;
            const parsed = JSON.parse(plain);
            myRecords.push({
              id: i, patientAddress, uploader,
              timestamp: new Date(timestamp.toNumber() * 1000),
              ...parsed
            });
          } catch { continue; }
        } catch (recordErr) {
          console.warn(`Gagal membaca record #${i}:`, recordErr);
        }
      }

      myRecords.sort((a, b) => b.timestamp - a.timestamp);
      setRecords(myRecords);
    } catch (err) {
      console.error("Gagal mengambil data dari blockchain:", err);
      addToast("error", "Gagal Memuat", "Gagal memuat riwayat catatan medis. Coba refresh halaman.");
    } finally {
      setIsFetching(false);
    }
  };

  // ── Navigasi ke AI search dengan data rekam medis ──
  const handleCariRekomendasiAI = (record) => {
    const diagText = record.diagnosis ? record.diagnosis.trim() : "";
    const gejalaText = record.gejala ? record.gejala.trim() : "";
    let combinedTextForSbert = diagText;
    if (gejalaText) {
      combinedTextForSbert += `. Pasien juga mengeluhkan: ${gejalaText}`;
    }
    navigate("/ai-search", {
      state: {
        useSbertMode: true,
        sbertQuery: combinedTextForSbert,
        kondisiKhusus: record.kondisiKhusus
      }
    });
  };

  // ── Pasien ACC draft ──
  const handleApproveDraft = async (draft) => {
    const confirmed = await showModal({
      type: "confirm",
      icon: "🔐",
      title: "Setujui Rekam Medis?",
      message: `Data dari Dr. ${draft.doctor_name || "Dokter"} akan disimpan secara permanen dan tidak dapat diubah.`,
      sub: "Dompet digital Anda akan terbuka untuk konfirmasi. Pastikan Anda sudah memeriksa data dengan teliti.",
      confirmText: "Ya, Saya Setuju",
      cancelText: "Batal"
    });
    if (!confirmed) return;

    try {
      setIsProcessingDraft(true);
      if (!window.ethereum) {
        addToast("error", "Dompet Digital Tidak Ditemukan", "Silakan install ekstensi MetaMask di browser Anda.");
        return;
      }

      setLoadingMsg("Menghubungkan dompet digital...");
      const provider = new ethers.providers.Web3Provider(window.ethereum, "any");
      await provider.send("eth_requestAccounts", []);

      setLoadingMsg("Memverifikasi akses akun...");
      const readContract = getReadOnlyContract();
      const checksumWallet = ethers.utils.getAddress(userWallet);
      const isApproved = await readContract.isApprovedUser(checksumWallet);

      if (!isApproved) {
        setLoadingMsg("Mendaftarkan akun Anda...");
        const approveRes = await fetch(`${API}/api/connect-wallet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: JSON.parse(localStorage.getItem("user_profile") || "{}").id,
            wallet_address: userWallet
          })
        });
        if (!approveRes.ok) {
          addToast("error", "Akun Belum Terdaftar", "Hubungi admin untuk mendaftarkan akun Anda terlebih dahulu.");
          return;
        }
        await new Promise(r => setTimeout(r, 2000));
      }

      setLoadingMsg("Mengamankan data rekam medis...");
      const medicalDataObj = {
        diagnosis:       draft.record_data.diagnosis       || "",
        gejala:          draft.record_data.gejala          || "",
        obat:            draft.record_data.obat            || "",
        kondisiKhusus:   draft.record_data.kondisiKhusus   || "",
        catatanTambahan: draft.record_data.catatanTambahan || "",
        dokterName:      draft.doctor_name    || "Dokter",
        instansi:        draft.doctor_instansi || "-",
        doctor_wallet:   draft.doctor_wallet  || ""
      };
      const cipherText = CryptoJS.AES.encrypt(
        JSON.stringify(medicalDataObj), userWallet
      ).toString();

      setLoadingMsg("Menunggu konfirmasi dari dompet digital Anda...");
      const signerContract = await getSignerContract();
      const tx = await signerContract.addMedicalRecord(checksumWallet, cipherText);

      setLoadingMsg("Menyimpan data secara permanen...");
      const receipt = await tx.wait();
      const txHash = receipt.transactionHash || receipt.hash;

      await fetch(
        `${API}/api/medical-record/draft/${draft.id}/approve?tx_hash=${encodeURIComponent(txHash)}`,
        { method: "POST" }
      );

      setSelectedDraft(null);
      fetchPendingDrafts();
      fetchRecordsFromBlockchain();
      addToast("success", "Rekam Medis Tersimpan!", "Data rekam medis Anda telah disimpan secara aman dan permanen.", "", 8000);

    } catch (error) {
      const msg = error?.message || error?.reason || String(error);
      if (error.code === 4001 || msg.includes("user rejected") || msg.includes("denied")) {
        addToast("warning", "Dibatalkan", "Penyimpanan dibatalkan. Data belum tersimpan.");
      } else {
        addToast("error", "Gagal Menyimpan", "Terjadi kesalahan. Silakan coba lagi.", msg);
      }
    } finally {
      setIsProcessingDraft(false);
      setLoadingMsg("");
    }
  };

  // ── Pasien TOLAK draft ──
  const handleRejectDraft = async (draft) => {
    const confirmed = await showModal({
      type: "danger",
      icon: "🗑️",
      title: "Tolak Rekam Medis?",
      message: `Data dari Dr. ${draft.doctor_name || "Dokter"} akan dihapus permanen.`,
      sub: "Dokter harus mengisi ulang rekam medis dari awal jika ingin mengirim kembali.",
      confirmText: "Ya, Tolak & Hapus",
      cancelText: "Batal"
    });
    if (!confirmed) return;

    try {
      setIsProcessingDraft(true);
      const res = await fetch(`${API}/api/medical-record/draft/${draft.id}/reject`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        addToast("error", "Gagal Menolak", data.detail || "Terjadi kesalahan.");
        return;
      }
      setSelectedDraft(null);
      fetchPendingDrafts();
      addToast("success", "Draft Ditolak", "Rekam medis telah dihapus. Dokter perlu mengisi ulang.");
    } catch (err) {
      addToast("error", "Kesalahan", "Gagal menolak draft. Coba lagi.");
    } finally {
      setIsProcessingDraft(false);
    }
  };

  const filteredRecords = records.filter(r =>
    (r.diagnosis || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.dokterName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.obat || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTanggal = (date) => new Date(date).toLocaleDateString("id-ID", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric"
  });

  const formatTanggalTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) +
      " · " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <MainLayout>
      {/* Toast Notifications */}
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* Confirm Modal */}
      <ConfirmModal modal={modal} onConfirm={handleModalConfirm} onCancel={handleModalCancel} />

      {/* Loading Overlay */}
      <LoadingOverlay show={isProcessingDraft} message={loadingMsg} />

      <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-blue-50/50 to-transparent -z-10" />

      <div className="max-w-6xl mx-auto px-4 mt-16 pb-24 relative z-10">

        {!selectedRecord && !selectedDraft && (
          <div className="text-center mb-12 animate-fade-in">
            <span className="bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase mb-4 inline-block">Privasi Terjamin</span>
            <h1 className="text-3xl md:text-4xl font-extrabold text-dark-50 mb-3">Catatan Medis Anda</h1>
            <p className="text-gray-500 max-w-xl mx-auto">Verifikasi rekam medis dari dokter dan lihat riwayat catatan yang tersimpan aman di Blockchain.</p>
          </div>
        )}

        <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">

          {/* ── DETAIL RECORD BLOCKCHAIN (Premium UI dari repo) ── */}
          {selectedRecord && (
            <div className="animate-fade-in flex flex-col">
              <div className="bg-gray-50/50 border-b border-gray-100 px-8 py-6 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-extrabold text-dark-50">Dokumen Rekam Medis</h2>
                  <p className="text-sm text-gray-500 mt-1">ID: #{selectedRecord.id} • Diterbitkan pada {formatTanggal(selectedRecord.timestamp)}</p>
                </div>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="bg-white border border-gray-200 text-gray-600 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition shadow-sm flex items-center gap-2"
                >
                  <span>✕</span> Tutup
                </button>
              </div>

              <div className="p-8 md:p-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-dashed border-gray-200 mb-8">
                  <div className="flex items-center gap-4">
                    <Avatar name={selectedRecord.dokterName} fotoProfil={null} size="lg" />
                    <div>
                      <p className="text-sm text-gray-400 font-medium uppercase tracking-wide">Pemeriksa</p>
                      <p className="text-xl font-bold text-gray-800">{selectedRecord.dokterName || "Dokter Anonim"}</p>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-center gap-3">
                    <span className="text-blue-500 text-xl">⛓️</span>
                    <div>
                      <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">Blockchain Verified</p>
                      <p className="text-[10px] font-mono text-blue-600/80 mt-0.5 break-all max-w-[200px]">By: {selectedRecord.uploader?.substring(0,12)}...</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="space-y-6">
                    <div>
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-400"></span> Diagnosis Penyakit</p>
                      <p className="text-lg text-gray-800 font-medium bg-gray-50 p-4 rounded-xl border border-gray-100">{selectedRecord.diagnosis || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Gejala Dialami</p>
                      <p className="text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100 leading-relaxed">{selectedRecord.gejala || "-"}</p>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-400"></span> Obat / Terapi Saat Ini</p>
                      <p className="text-lg text-gray-800 font-medium bg-gray-50 p-4 rounded-xl border border-gray-100">{selectedRecord.obat || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-400"></span> Kondisi Khusus</p>
                      <p className="text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100 font-semibold">{selectedRecord.kondisiKhusus || "-"}</p>
                    </div>
                  </div>
                  {selectedRecord.catatanTambahan && (
                    <div className="col-span-full">
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-400"></span> Catatan Tambahan</p>
                      <p className="text-gray-600 bg-gray-50/50 p-4 rounded-xl border border-gray-100 italic">"{selectedRecord.catatanTambahan}"</p>
                    </div>
                  )}
                </div>

                {/* Tombol Cari Herbal AI */}
                <div className="flex justify-end">
                  <button
                    onClick={() => handleCariRekomendasiAI(selectedRecord)}
                    className="bg-gradient-to-r from-primary-40 to-primary-60 text-white font-bold px-6 py-3 rounded-xl shadow-md hover:shadow-lg transition-transform active:scale-95 flex items-center gap-2"
                  >
                    ✨ Cari Rekomendasi Herbal dengan AI
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── DETAIL DRAFT PENDING ── */}
          {selectedDraft && (
            <div className="animate-fade-in p-8 md:p-12">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-extrabold text-dark-50">⏳ Rekam Medis Menunggu Verifikasi</h2>
                  <p className="text-sm text-orange-500 mt-1">Periksa dengan teliti sebelum menyetujui</p>
                </div>
                <button onClick={() => setSelectedDraft(null)} className="bg-white border border-gray-200 text-gray-600 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition shadow-sm flex items-center gap-2">
                  <span>✕</span> Tutup
                </button>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-6">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <p className="font-semibold text-orange-800 mb-1">Perhatian: Rekam medis ini perlu persetujuan Anda</p>
                    <p className="text-sm text-orange-700">
                      Jika Anda <strong>Setuju</strong>, data akan disimpan secara aman dan permanen — tidak dapat diubah siapapun.
                      Jika Anda <strong>Tolak</strong>, data akan dihapus dan dokter perlu mengisi ulang.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Dokter</p>
                  <p className="font-semibold text-gray-800">{selectedDraft.doctor_name || "-"}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Instansi</p>
                  <p className="font-semibold text-gray-800">{selectedDraft.doctor_instansi || "-"}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 col-span-full">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Tanggal Dibuat</p>
                  <p className="font-semibold text-gray-800">{formatTanggalTime(selectedDraft.created_at)}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-5 border border-green-100 col-span-full">
                  <p className="text-xs text-green-500 mb-1 uppercase tracking-wide font-semibold">Diagnosis</p>
                  <p className="text-gray-800">{selectedDraft.record_data?.diagnosis || "-"}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 col-span-full">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Gejala</p>
                  <p className="text-gray-800">{selectedDraft.record_data?.gejala || "-"}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Resep Obat</p>
                  <p className="font-semibold text-gray-800">{selectedDraft.record_data?.obat || "-"}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Kondisi Khusus</p>
                  <p className="font-semibold text-gray-800">{selectedDraft.record_data?.kondisiKhusus || "-"}</p>
                </div>
                {selectedDraft.record_data?.catatanTambahan && (
                  <div className="bg-yellow-50 rounded-xl p-5 border border-yellow-100 col-span-full">
                    <p className="text-xs text-yellow-600 mb-1 uppercase tracking-wide">Catatan Tambahan</p>
                    <p className="text-gray-800">{selectedDraft.record_data.catatanTambahan}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-4 justify-end">
                <button
                  onClick={() => handleRejectDraft(selectedDraft)}
                  disabled={isProcessingDraft}
                  className="px-8 py-4 rounded-xl font-bold text-base border-2 transition-all transform active:scale-95 bg-white text-red-500 border-red-300 hover:bg-red-50 hover:border-red-400 disabled:opacity-40"
                >
                  ❌ Tolak
                </button>
                <button
                  onClick={() => handleApproveDraft(selectedDraft)}
                  disabled={isProcessingDraft}
                  className="px-8 py-4 rounded-xl font-bold text-base shadow-lg transition-all transform active:scale-95 bg-primary-40 hover:bg-primary-50 text-white disabled:opacity-40"
                >
                  ✅ Saya Setujui Rekam Medis Ini
                </button>
              </div>
            </div>
          )}

          {/* ── TAMPILAN TAB UTAMA ── */}
          {!selectedRecord && !selectedDraft && (
            <div className="p-8 md:p-10">
              {/* Tab Header */}
              <div className="flex gap-2 mb-8 border-b border-gray-100">
                <button
                  onClick={() => setActiveTab("draft")}
                  className={`pb-3 px-4 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === "draft"
                      ? "border-orange-400 text-orange-500"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  ⏳ Menunggu Verifikasi
                  {pendingDrafts.length > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                      {pendingDrafts.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("blockchain")}
                  className={`pb-3 px-4 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === "blockchain"
                      ? "border-primary-40 text-primary-40"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  📋 Riwayat Rekam Medis
                  {records.length > 0 && (
                    <span className="ml-1 bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                      {records.length}
                    </span>
                  )}
                </button>
              </div>

              {/* ── TAB: DRAFT PENDING ── */}
              {activeTab === "draft" && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <p className="text-sm text-gray-500">Rekam medis dari dokter yang perlu Anda verifikasi sebelum disimpan </p>
                    <button
                      onClick={fetchPendingDrafts}
                      disabled={isFetchingDrafts}
                      className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 p-3 rounded-xl transition shadow-sm"
                      title="Refresh"
                    >
                      {isFetchingDrafts ? "⏳" : "🔄"}
                    </button>
                  </div>

                  {isFetchingDrafts ? (
                    <div className="flex flex-col items-center justify-center py-24">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-100 border-t-orange-400 mb-4"></div>
                      <p className="text-gray-400 font-medium">Memeriksa rekam medis baru...</p>
                    </div>
                  ) : pendingDrafts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 text-3xl">✅</div>
                      <p className="text-gray-500 font-bold text-lg">Tidak ada rekam medis yang perlu diverifikasi</p>
                      <p className="text-gray-400 text-sm mt-1 text-center">Semua rekam medis sudah diproses</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingDrafts.map((draft) => (
                        <div
                          key={draft.id}
                          className="border border-orange-200 bg-orange-50 rounded-2xl p-6 hover:shadow-md transition cursor-pointer"
                          onClick={() => setSelectedDraft(draft)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-full bg-white border border-orange-200 flex items-center justify-center text-xl shadow-sm">🩺</div>
                              <div>
                                <p className="font-bold text-gray-800">{draft.doctor_name || "Dokter"}</p>
                                <p className="text-xs text-gray-500">{draft.doctor_instansi || "-"}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{formatTanggalTime(draft.created_at)}</p>
                              </div>
                            </div>
                            <span className="bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1 rounded-full border border-orange-200 animate-pulse">
                              ⏳ Perlu Verifikasi
                            </span>
                          </div>
                          <div className="mt-4 bg-white rounded-xl p-4 border border-orange-100">
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Diagnosis</p>
                            <p className="text-gray-800 font-medium truncate">{draft.record_data?.diagnosis || "-"}</p>
                          </div>
                          <div className="mt-3 flex gap-3 justify-end">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRejectDraft(draft); }}
                              disabled={isProcessingDraft}
                              className="px-5 py-2 rounded-xl text-sm font-semibold text-red-500 border border-red-200 hover:bg-red-50 transition"
                            >
                              ❌ Tolak
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedDraft(draft); }}
                              className="px-5 py-2 rounded-xl text-sm font-semibold bg-primary-40 text-white hover:bg-primary-50 transition"
                            >
                              🔍 Periksa Detail
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: RIWAYAT BLOCKCHAIN (Premium UI dari repo) ── */}
              {activeTab === "blockchain" && (
                <div>
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
                    <h2 className="text-xl font-bold text-dark-50">Daftar Kunjungan Medis</h2>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <div className="relative flex-1 md:w-64">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </div>
                        <input
                          type="text"
                          placeholder="Cari diagnosis atau dokter..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 pr-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-30 focus:border-transparent text-sm w-full transition"
                        />
                      </div>
                      <button
                        onClick={fetchRecordsFromBlockchain}
                        disabled={isFetching}
                        className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 p-3 rounded-xl transition shadow-sm"
                        title="Refresh Data"
                      >
                        {isFetching ? "⏳" : "🔄"}
                      </button>
                    </div>
                  </div>

                  {isFetching ? (
                    <div className="flex flex-col items-center justify-center py-24">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-100 border-t-primary-40 mb-4"></div>
                      <p className="text-gray-400 font-medium">Mendekripsi data dari Blockchain...</p>
                    </div>
                  ) : filteredRecords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 text-3xl">📋</div>
                      <p className="text-gray-500 font-bold text-lg">Belum ada catatan medis</p>
                      <p className="text-gray-400 text-sm mt-1 max-w-sm text-center">Rekam medis Anda akan muncul di sini setelah Anda menyetujui draft dari dokter.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-100">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-semibold">
                          <tr>
                            <th className="py-4 px-6 border-b border-gray-100 whitespace-nowrap">Tanggal Periksa</th>
                            <th className="py-4 px-6 border-b border-gray-100">Pemeriksa</th>
                            <th className="py-4 px-6 border-b border-gray-100">Diagnosis Utama</th>
                            <th className="py-4 px-6 border-b border-gray-100 text-center">Aksi Cepat</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRecords.map((record) => (
                            <tr key={record.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors group">
                              <td className="py-4 px-6 text-gray-600 font-medium whitespace-nowrap">
                                {new Date(record.timestamp).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                              </td>
                              <td className="py-4 px-6 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <Avatar name={record.dokterName} fotoProfil={null} size="sm" />
                                  <span className="font-semibold text-gray-800">{record.dokterName || "-"}</span>
                                </div>
                              </td>
                              <td className="py-4 px-6 text-gray-600 max-w-[250px] truncate" title={record.diagnosis}>
                                {record.diagnosis || "-"}
                              </td>
                              <td className="py-4 px-6">
                                <div className="flex items-center justify-center gap-3">
                                  <button
                                    onClick={() => setSelectedRecord(record)}
                                    className="text-gray-500 hover:text-primary-40 font-medium px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:bg-primary-10/50 text-xs whitespace-nowrap"
                                  >
                                    Lihat Detail
                                  </button>
                                  <button
                                    onClick={() => handleCariRekomendasiAI(record)}
                                    className="bg-gradient-to-r from-primary-40 to-primary-60 text-white font-bold px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-transform active:scale-95 text-xs whitespace-nowrap flex items-center gap-1.5"
                                    title="Cari Rekomendasi Herbal dengan AI SBERT"
                                  >
                                    ✨ Cari Herbal
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Animasi CSS */}
      <style>{`
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(100px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        .animate-slide-in { animation: slide-in 0.4s cubic-bezier(.21,1.02,.73,1) both; }
        .animate-scale-in { animation: scale-in 0.3s cubic-bezier(.21,1.02,.73,1) both; }
        .animate-fade-in  { animation: scale-in 0.25s ease both; }
      `}</style>
    </MainLayout>
  );
}