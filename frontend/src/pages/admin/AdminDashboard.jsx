import React, { useEffect, useState, useRef } from "react";
import MainLayout from "../../layouts/MainLayout";
import { getSignerContract, getSigner } from "../../utils/web3"; 

export default function AdminDashboard() {
  const [pendingDoctors, setPendingDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState({});

  // State Modal (Milik Anda)
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  
  // State Toast (Milik Anda)
  const [actionResult, setActionResult] = useState({
    isOpen: false,
    type: 'success', 
    title: '',
    message: ''
  });
  
  const [selectedDoctor, setSelectedDoctor] = useState(null);
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

  const showToast = (type, title, message) => {
    setActionResult({ isOpen: true, type, title, message });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setActionResult(prev => ({ ...prev, isOpen: false }));
    }, 4000);
  };

  // --- LOGIKA APPROVE (Blockchain + Database) ---
  const executeApprove = async () => {
    if (!selectedDoctor) return;
    const { walletAddress, nama } = selectedDoctor;

    setIsApproveModalOpen(false);
    setApproving((prev) => ({ ...prev, [walletAddress]: true }));

    try {
      // 1. Blockchain (Kode Teman)
      const signer = await getSigner();
      const signerAddress = await signer.getAddress();
      const contract = await getSignerContract();
      const isAdminOnChain = await contract.isAdmin(signerAddress);

      if (!isAdminOnChain) {
        throw new Error("MetaMask Anda bukan Admin di Smart Contract!");
      }

      const tx = await contract.approveUser(walletAddress);
      await tx.wait(); 

      // 2. Database (Kode Anda)
      const response = await fetch("http://localhost:8000/api/admin/approve_doctor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: walletAddress }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Gagal update database");

      showToast('success', 'Berhasil', `${nama} telah disahkan di Blockchain & Database.`);
      fetchPendingDoctors();
    } catch (error) {
      const msg = error?.data?.message || error?.reason || error.message;
      showToast('danger', 'Gagal Approve', msg);
    } finally {
      setApproving((prev) => ({ ...prev, [walletAddress]: false }));
      setSelectedDoctor(null);
    }
  };

  // --- LOGIKA REJECT ---
  const executeReject = async () => {
    if (!selectedDoctor) return;
    try {
      const response = await fetch("http://localhost:8000/api/admin/reject_doctor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: selectedDoctor.walletAddress }),
      });

      if (!response.ok) throw new Error("Gagal menolak pengajuan");

      setIsRejectModalOpen(false); 
      showToast('danger', 'Ditolak', `Pengajuan ${selectedDoctor.nama} telah dihapus.`);
      fetchPendingDoctors();
    } catch (error) {
      showToast('danger', 'Error', error.message);
    } finally {
      setSelectedDoctor(null);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 mt-16 pb-12 relative">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-dark-50">Dashboard Administrator</h1>
          <p className="text-dark-30 mt-2 text-sm">Verifikasi akses tenaga medis ke jaringan Blockchain.</p>
        </div>

        {/* Info Box MetaMask */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4 mb-8 flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <p className="text-xs text-amber-700 leading-relaxed">
            <strong>Penting:</strong> Pastikan MetaMask terhubung ke akun Admin (deployer) untuk melakukan <code className="bg-amber-100 px-1 rounded">approveUser()</code>.
          </p>
        </div>

        {/* Tabel Antrean */}
        <div className="bg-white rounded-3xl shadow-xl border border-light-40 overflow-hidden relative z-10">
          <div className="p-8 border-b border-light-40 flex items-center justify-between">
            <h2 className="text-xl font-bold">Antrean Verifikasi</h2>
            <span className="bg-primary-10 text-primary-50 px-4 py-1.5 rounded-full text-xs font-bold">
              Total: {pendingDoctors.length}
            </span>
          </div>
          <div className="p-8 overflow-x-auto">
            {loading ? <p className="text-center py-10">Memuat data...</p> : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2 border-primary-20 text-dark-30 text-xs uppercase font-bold">
                    <th className="py-4 px-4">Nama Akun</th>
                    <th className="py-4 px-4">Wallet</th>
                    <th className="py-4 px-4">STR</th>
                    <th className="py-4 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingDoctors.map((doc, idx) => (
                    <tr key={idx} className="border-b border-light-30 hover:bg-gray-50/50 transition">
                      <td className="py-4 px-4 font-medium text-sm">{doc.name || "Anonim"}</td>
                      <td className="py-4 px-4 font-mono text-[10px] text-gray-400">{doc.wallet_address.substring(0,10)}...</td>
                      <td className="py-4 px-4 text-sm">{doc.nomor_str}</td>
                      <td className="py-4 px-4 flex justify-center gap-2">
                        <button onClick={() => {setSelectedDoctor({walletAddress: doc.wallet_address, nama: doc.name}); setIsRejectModalOpen(true);}} className="text-red-600 bg-red-50 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-100">Tolak</button>
                        <button onClick={() => {setSelectedDoctor({walletAddress: doc.wallet_address, nama: doc.name}); setIsApproveModalOpen(true);}} disabled={approving[doc.wallet_address]} className="bg-primary-40 text-white px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50">
                          {approving[doc.wallet_address] ? "⏳ Proses" : "✓ Approve"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Panel Approve Pasien Manual (Kode Teman Anda) */}
        <div className="mt-8 bg-white rounded-3xl shadow-sm border border-light-40 p-8">
           <h2 className="text-lg font-bold mb-2">Approve Wallet Pasien Manual</h2>
           <ApprovePatientForm getSigner={getSigner} getSignerContract={getSignerContract} showToast={showToast} />
        </div>

        {/* Toast Notification (Milik Anda) */}
        {actionResult.isOpen && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] animate-fade-in pointer-events-none">
            <div className={`px-6 py-4 rounded-2xl bg-white border-l-8 shadow-2xl flex items-center gap-4 ${actionResult.type === 'success' ? 'border-l-green-500' : 'border-l-red-500'}`}>
              <h4 className="font-bold text-gray-800 text-sm">{actionResult.title}: <span className="font-normal text-gray-500">{actionResult.message}</span></h4>
            </div>
          </div>
        )}

        {/* Modal Konfirmasi Approve */}
        {isApproveModalOpen && selectedDoctor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-50/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center border border-gray-100 animate-fade-in">
              <h3 className="text-xl font-bold mb-4 text-gray-800">Sahkan Dokter?</h3>
              <p className="text-sm text-gray-500 mb-8 leading-relaxed">Anda akan mengesahkan <span className="font-bold">{selectedDoctor.nama}</span>. MetaMask akan terbuka untuk transaksi blockchain.</p>
              <div className="flex gap-3">
                <button onClick={() => setIsApproveModalOpen(false)} className="flex-1 py-3 text-gray-400 font-semibold">Batal</button>
                <button onClick={executeApprove} className="flex-1 py-3 rounded-xl text-white bg-primary-40 font-bold">Lanjutkan</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Konfirmasi Reject */}
        {isRejectModalOpen && selectedDoctor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-50/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center animate-fade-in">
              <h3 className="text-xl font-bold mb-4 text-red-600">Tolak Pengajuan?</h3>
              <p className="text-sm text-gray-500 mb-8">Data pengajuan <span className="font-bold">{selectedDoctor.nama}</span> akan dihapus selamanya.</p>
              <div className="flex gap-3">
                <button onClick={() => setIsRejectModalOpen(false)} className="flex-1 py-3 text-gray-400 font-semibold">Batal</button>
                <button onClick={executeReject} className="flex-1 py-3 rounded-xl text-white bg-red-500 font-bold">Ya, Tolak</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

// Komponen Form Manual (Diperbaiki komunikasinya dengan UI Utama)
function ApprovePatientForm({ getSigner, getSignerContract, showToast }) {
  const [walletInput, setWalletInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprovePatient = async () => {
    const wallet = walletInput.trim();
    if (!wallet || wallet.length !== 42) return showToast('danger', 'Error', 'Alamat wallet tidak valid!');

    setIsProcessing(true);
    try {
      const signer = await getSigner();
      const signerAddress = await signer.getAddress();
      const contract = await getSignerContract();

      const isAdminCheck = await contract.isAdmin(signerAddress);
      if (!isAdminCheck) throw new Error("MetaMask bukan Admin!");

      const tx = await contract.approveUser(wallet);
      await tx.wait();
      showToast('success', 'Berhasil', 'Wallet pasien berhasil disahkan.');
      setWalletInput("");
    } catch (error) {
      showToast('danger', 'Gagal', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex gap-3">
      <input type="text" value={walletInput} onChange={(e) => setWalletInput(e.target.value)} placeholder="0x... (wallet address)" className="flex-1 px-4 py-2 border rounded-xl text-sm font-mono" />
      <button onClick={handleApprovePatient} disabled={isProcessing} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold disabled:opacity-50">🔐 {isProcessing ? "Proses..." : "Approve"}</button>
    </div>
  );
}