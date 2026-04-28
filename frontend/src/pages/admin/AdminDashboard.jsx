import React, { useEffect, useState, useRef } from "react";
import MainLayout from "../../layouts/MainLayout";
import { getSignerContract, getSigner } from "../../utils/web3"; 
import { sortByDate } from "../../utils/sort";
import { formatTanggal } from "../../utils/formatTanggal";
import { AlertTriangle, ChevronUp, ChevronDown, FileText } from "lucide-react";

export default function AdminDashboard() {
  const [pendingDoctors, setPendingDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState("desc"); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  
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

  const sortedDoctors = sortByDate(pendingDoctors, "created_at", sortOrder);

  // --- LOGIKA APPROVE (Blockchain + Database) ---
  const executeApprove = async () => {
    if (!selectedDoctor) return;
    const walletAddress = selectedDoctor.wallet_address;
    const nama = selectedDoctor.name;

    setIsModalOpen(false);

    try {
      const signer = await getSigner();
      const signerAddress = await signer.getAddress();
      const contract = await getSignerContract();
      const isAdminOnChain = await contract.isAdmin(signerAddress);

      if (!isAdminOnChain) {
        throw new Error("MetaMask Anda bukan Admin di Smart Contract!");
      }

      const tx = await contract.approveUser(walletAddress);
      await tx.wait(); 

      const response = await fetch("http://localhost:8000/api/admin/approve_doctor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: walletAddress }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Gagal update database");

      const isGantiInstansi = selectedDoctor.instansi_lama && selectedDoctor.instansi_baru;

      if (isGantiInstansi) {
        showToast(
          'success',
          'Berhasil',
          `Perubahan instansi ${nama} telah berhasil disetujui.`
        );
      } else {
        showToast(
          'success',
          'Berhasil',
          `${nama} telah resmi disahkan sebagai dokter terverifikasi.`
        );
      }
      fetchPendingDoctors();
    } catch (error) {
      const msg = error?.data?.message || error?.reason || error.message;
      showToast('danger', 'Gagal Approve', msg);
    } finally {
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
        body: JSON.stringify({ wallet_address: selectedDoctor.wallet_address }),
      });

      if (!response.ok) throw new Error("Gagal menolak pengajuan");

      setIsModalOpen(false); 
      showToast('danger', 'Ditolak', `Pengajuan ${selectedDoctor.name} telah dihapus.`);
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
          <p className="text-dark-30 mt-2 text-sm">Kelola dan verifikasi pengajuan akun tenaga medis.</p>
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
                    <th
                      onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                      className="py-4 px-4 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2">
                        Tanggal Pengajuan

                        <div className="flex flex-col leading-none ml-1">
                          <ChevronUp
                            size={14}
                            className={`transition ${
                              sortOrder === "asc" ? "text-blue-600" : "text-gray-300"
                            }`}
                          />
                          <ChevronDown
                            size={14}
                            className={`-mt-1 transition ${
                              sortOrder === "desc" ? "text-blue-600" : "text-gray-300"
                            }`}
                          />
                        </div>
                      </div>
                    </th>
                    <th className="py-4 px-4">Nama Akun</th>
                    <th className="py-4 px-4">Jenis Pengajuan</th>
                    <th className="py-4 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDoctors.map((doc, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50 transition">

                      <td className="py-4 px-4 text-sm font-medium">
                        {formatTanggal(doc.created_at)}
                      </td>

                      <td className="py-4 px-4 font-medium text-sm">
                        {doc.name || "Anonim"}
                      </td>

                      <td className="py-4 px-4">
                        {doc.nomor_str ? (
                          <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                            Dokter Baru
                          </span>
                        ) : (
                          <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
                            Ganti Instansi
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedDoctor(doc);
                            setIsModalOpen(true);        
                          }}
                          className="text-blue-600 hover:text-blue-700 font-medium underline underline-offset-4 transition text-sm"
                        >
                          Lihat Detail
                        </button>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>



        {/* Toast Notification (Milik Anda) */}
        {actionResult.isOpen && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] animate-fade-in pointer-events-none">
            <div className={`px-6 py-4 rounded-2xl bg-white border-l-8 shadow-2xl flex items-center gap-4 ${actionResult.type === 'success' ? 'border-l-green-500' : 'border-l-red-500'}`}>
              <h4 className="font-bold text-gray-800 text-sm">{actionResult.title}: <span className="font-normal text-gray-500">{actionResult.message}</span></h4>
            </div>
          </div>
        )}

        {/* ==================== MODAL DETAIL ==================== */}
        {isModalOpen && selectedDoctor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-50/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8">

              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">Review Pengajuan</h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-xs text-gray-400">Nama</p>
                  <p className="font-semibold text-lg">{selectedDoctor.name}</p>
                </div>

                <div>
                  <p className="text-xs text-gray-400">Jenis Pengajuan</p>
                  <p className="font-semibold">
                    {selectedDoctor.instansi_lama ? "Perubahan Instansi" : "Pendaftaran Dokter Baru"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-400 mb-1">Instansi</p>
                  {selectedDoctor.instansi_lama ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <p className="text-xs text-gray-500 line-through">{selectedDoctor.instansi_lama}</p>
                      <p className="text-center text-gray-400 my-1">↓</p>
                      <p className="font-bold text-blue-700">{selectedDoctor.instansi_baru}</p>
                    </div>
                  ) : (
                    <p className="font-semibold">{selectedDoctor.nama_instansi || "-"}</p>
                  )}
                </div>

                <div>
                  <p className="text-xs text-gray-400">Tanggal Pengajuan</p>
                  <p className="font-semibold">{formatTanggal(selectedDoctor.created_at)}</p>
                </div>

                {selectedDoctor.nomor_str && (
                  <div>
                    <p className="text-xs text-gray-400">Nomor STR</p>
                    <p className="font-semibold font-mono">{selectedDoctor.nomor_str}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs text-gray-400 mb-2">Dokumen Pendukung</p>
                  <div className="space-y-2">
                    {selectedDoctor.dokumen_str_url ? (
                      <a
                        href={selectedDoctor.dokumen_str_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 underline text-sm"
                      >
                        <FileText size={14} /> Lihat Dokumen STR
                      </a>
                    ) : (
                      <p className="text-gray-400 text-sm">Dokumen STR tidak tersedia</p>
                    )}
                    {selectedDoctor.dokumen_sip_url ? (
                      <a
                        href={selectedDoctor.dokumen_sip_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-green-600 hover:text-green-700 underline text-sm"
                      >
                        <FileText size={14} /> Lihat Dokumen SIP
                      </a>
                    ) : (
                      <p className="text-gray-400 text-sm">Dokumen SIP tidak tersedia</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-red-400 my-6">
                <AlertTriangle size={16} className="text-red-400" />
                <span>Pastikan semua data sudah benar sebelum mengambil keputusan</span>
              </div>

              {/* Tombol Tolak & Setujui */}
              <div className="flex gap-3">
                <button
                  onClick={executeReject}
                  className="flex-1 py-3.5 border border-red-300 text-red-600 font-medium rounded-2xl hover:bg-red-50 transition"
                >
                  Tolak Pengajuan
                </button>
                <button
                  onClick={executeApprove}
                  className="flex-1 py-3.5 bg-primary-50 text-white font-bold rounded-2xl hover:bg-primary-60 transition"
                >
                  Setujui Pengajuan
                </button>
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