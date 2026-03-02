import React, { useEffect, useState, useRef } from "react";
import MainLayout from "../../layouts/MainLayout";

export default function AdminDashboard() {
  const [pendingDoctors, setPendingDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  // State untuk mengontrol Modal Konfirmasi
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  
  // State untuk Toast Notification (Melayang & Hilang Otomatis)
  const [actionResult, setActionResult] = useState({
    isOpen: false,
    type: 'success', 
    title: '',
    message: ''
  });
  
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  
  // Referensi untuk mengatur timer auto-close Toast
  const toastTimer = useRef(null);

  useEffect(() => {
    fetchPendingDoctors();
  }, []);

  const fetchPendingDoctors = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/admin/pending_doctors");
      const data = await response.json();
      setPendingDoctors(data);
    } catch (error) {
      console.error("Gagal mengambil data antrean dokter:", error);
    } finally {
      setLoading(false);
    }
  };

  const openApproveModal = (walletAddress, nama) => {
    setSelectedDoctor({ walletAddress, nama });
    setIsApproveModalOpen(true);
  };

  const openRejectModal = (walletAddress, nama) => {
    setSelectedDoctor({ walletAddress, nama });
    setIsRejectModalOpen(true);
  };

  // --- FUNGSI UNTUK MENAMPILKAN TOAST ---
  const showToast = (type, title, message) => {
    setActionResult({ isOpen: true, type, title, message });
    
    // Reset timer jika ada notifikasi baru masuk sebelum yang lama hilang
    if (toastTimer.current) clearTimeout(toastTimer.current);
    
    // Hilangkan otomatis setelah 3.5 detik
    toastTimer.current = setTimeout(() => {
      setActionResult(prev => ({ ...prev, isOpen: false }));
    }, 3500);
  };

  const executeApprove = async () => {
    if (!selectedDoctor) return;
    try {
      const response = await fetch("http://localhost:8000/api/admin/approve_doctor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: selectedDoctor.walletAddress }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Gagal mengesahkan dokter");

      setIsApproveModalOpen(false); 
      showToast('success', 'Verifikasi Berhasil', `Akun atas nama ${selectedDoctor.nama} telah resmi disahkan.`);
      
      setSelectedDoctor(null);
      fetchPendingDoctors();
    } catch (error) {
      setIsApproveModalOpen(false);
      showToast('danger', 'Terjadi Kesalahan', error.message);
    }
  };

  const executeReject = async () => {
    if (!selectedDoctor) return;
    try {
      const response = await fetch("http://localhost:8000/api/admin/reject_doctor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: selectedDoctor.walletAddress }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Gagal menolak pengajuan");

      setIsRejectModalOpen(false); 
      showToast('danger', 'Pengajuan Ditolak', `Pengajuan akses dokter atas nama ${selectedDoctor.nama} telah dihapus dari antrean.`);
      
      setSelectedDoctor(null);
      fetchPendingDoctors();
    } catch (error) {
      setIsRejectModalOpen(false);
      showToast('danger', 'Terjadi Kesalahan', error.message);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 mt-16 pb-12 relative">
        <div className="mb-12">
          <h1 className="text-3xl font-extrabold text-dark-50">Dashboard Administrator</h1>
          <p className="text-dark-30 mt-2">Pusat kontrol dan verifikasi akses jaringan Blockchain Anda.</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-light-40 overflow-hidden relative z-10">
          <div className="p-8 border-b border-light-40 bg-gray-50 flex items-center justify-between">
            <h2 className="text-xl font-bold text-dark-50">Antrean Verifikasi Dokter</h2>
            <span className="bg-primary-10 text-primary-50 px-4 py-2 rounded-full text-sm font-semibold">
              Total: {pendingDoctors.length} Menunggu
            </span>
          </div>

          <div className="p-8">
            {loading ? (
              <p className="text-center text-dark-30 py-10">Memuat data...</p>
            ) : pendingDoctors.length === 0 ? (
              <div className="text-center py-16">
                <span className="text-6xl mb-4 block">☕</span>
                <p className="text-dark-40 font-medium">Tidak ada antrean verifikasi dokter saat ini.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-primary-20 text-dark-30 text-sm">
                      <th className="py-4 px-4 font-semibold uppercase">Nama Akun</th>
                      <th className="py-4 px-4 font-semibold uppercase">Wallet Address</th>
                      <th className="py-4 px-4 font-semibold uppercase">No. STR</th>
                      <th className="py-4 px-4 font-semibold uppercase">Institusi</th>
                      <th className="py-4 px-4 font-semibold uppercase">Dokumen Bukti</th>
                      <th className="py-4 px-4 font-semibold text-center uppercase">Aksi Jaringan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingDoctors.map((doc, idx) => (
                      <tr key={idx} className="border-b border-light-30 hover:bg-gray-50/50 transition">
                        <td className="py-4 px-4 text-dark-50 font-medium">{doc.name || "Anonim"}</td>
                        <td className="py-4 px-4 text-dark-40 text-sm font-mono bg-light-20 rounded p-1 inline-block mt-3">
                          {doc.wallet_address.substring(0, 8)}...{doc.wallet_address.substring(38)}
                        </td>
                        <td className="py-4 px-4 text-dark-50">{doc.nomor_str}</td>
                        <td className="py-4 px-4 text-dark-50">{doc.nama_instansi}</td>
                        <td className="py-4 px-4">
                          {doc.dokumen_url ? (
                            <a 
                              href={doc.dokumen_url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-blue-500 hover:text-blue-700 underline font-medium text-sm flex items-center gap-1"
                            >
                              📄 Lihat PDF
                            </a>
                          ) : (
                            <span className="text-red-500 text-sm">Tidak ada</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openRejectModal(doc.wallet_address, doc.name)}
                              className="px-4 py-2 rounded-xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 transition active:scale-95 border border-red-100"
                            >
                              ✕ Tolak
                            </button>
                            <button
                              onClick={() => openApproveModal(doc.wallet_address, doc.name)}
                              className="bg-primary-40 text-white px-5 py-2 rounded-xl text-sm font-bold shadow hover:bg-primary-50 transition active:scale-95"
                            >
                              ✓ Setujui
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
        </div>

        {/* ========================================== */}
        {/* TOAST NOTIFICATION (MELAYANG & TANPA TOMBOL) */}
        {/* ========================================== */}
        {actionResult.isOpen && (
          <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[60] animate-fade-in shadow-2xl rounded-2xl pointer-events-none">
            <div className={`px-6 py-4 rounded-2xl bg-white border-l-8 flex items-center gap-4 min-w-[350px] ${
              actionResult.type === 'success' ? 'border-l-green-500' : 'border-l-red-500'
            }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                actionResult.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}>
                {actionResult.type === 'success' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                )}
              </div>
              <div>
                <h4 className="font-bold text-gray-800 text-sm">
                  {actionResult.title}
                </h4>
                <p className="text-gray-500 text-xs mt-0.5">{actionResult.message}</p>
              </div>
            </div>
          </div>
        )}

        {/* MODAL KONFIRMASI REJECT (MERAH) */}
        {isRejectModalOpen && selectedDoctor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-50/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-[420px] p-8 md:p-10 text-center transform transition-all border border-gray-100">
              <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border-[8px] border-red-50/50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">Tolak Pengajuan?</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-8 px-2">Anda yakin ingin menolak pengajuan akses dokter atas nama <span className="font-bold text-gray-700">{selectedDoctor.nama}</span>?</p>
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button onClick={() => { setIsRejectModalOpen(false); setSelectedDoctor(null); }} className="flex-1 py-3.5 rounded-xl text-gray-500 bg-gray-50 hover:bg-gray-100 font-semibold transition-colors border border-transparent hover:border-gray-200">Batal</button>
                <button onClick={executeReject} className="flex-1 py-3.5 rounded-xl text-white bg-red-500 hover:bg-red-600 font-semibold transition-all shadow-lg shadow-red-500/30 active:scale-95">Ya, Tolak</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL KONFIRMASI APPROVE (BIRU) */}
        {isApproveModalOpen && selectedDoctor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-50/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-[420px] p-8 md:p-10 text-center transform transition-all border border-gray-100">
              <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 border-[8px] border-blue-50/50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">Sahkan Dokter?</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-8 px-2">Anda akan mengesahkan <span className="font-bold text-gray-700">{selectedDoctor.nama}</span>. Pengguna ini akan memiliki akses penuh.</p>
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button onClick={() => { setIsApproveModalOpen(false); setSelectedDoctor(null); }} className="flex-1 py-3.5 rounded-xl text-gray-500 bg-gray-50 hover:bg-gray-100 font-semibold transition-colors border border-transparent hover:border-gray-200">Batal</button>
                <button onClick={executeApprove} className="flex-1 py-3.5 rounded-xl text-white bg-primary-40 hover:bg-primary-50 font-semibold transition-all shadow-lg shadow-primary-40/30 active:scale-95">Setujui & Sahkan</button>
              </div> 
            </div>
          </div>
        )} 
      </div>
    </MainLayout>
  );
}