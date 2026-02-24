import React, { useEffect, useState } from "react";
import MainLayout from "../../layouts/MainLayout";

export default function AdminDashboard() {
  const [pendingDoctors, setPendingDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const handleApprove = async (walletAddress, nama) => {
    const confirmation = window.confirm(`Apakah Anda yakin data atas nama ${nama} VALID dan ingin mengesahkannya di Smart Contract?`);
    if (!confirmation) return;

    try {
      // PERHATIAN: Di sistem blockchain asli, di sini Admin harus memanggil Metamask-nya
      // await contract.methods.approveDoctor(walletAddress).send({ from: adminAddress });
      
      // Karena ini simulasi web2 database, kita tembak endpoint backend sinkronisasi:
      const response = await fetch("http://localhost:8000/api/admin/approve_doctor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: walletAddress }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Gagal mengesahkan dokter");

      alert("Sukses! " + nama + " resmi diubah statusnya menjadi Doctor.");
      // Render ulang tabel
      fetchPendingDoctors();
    } catch (error) {
      alert("Error approving: " + error.message);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 mt-16 pb-12">
        <div className="mb-12">
          <h1 className="text-3xl font-extrabold text-dark-50">Dashboard Administrator</h1>
          <p className="text-dark-30 mt-2">Pusat kontrol dan verifikasi akses jaringan Blockchain Anda.</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-light-40 overflow-hidden">
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
                      <th className="py-4 px-4 font-semibold text-right uppercase">Aksi Jaringan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingDoctors.map((doc, idx) => (
                      <tr key={idx} className="border-b border-light-30 hover:bg-green-50/30 transition">
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
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => handleApprove(doc.wallet_address, doc.name)}
                            className="bg-primary-40 text-white px-6 py-2 rounded-xl text-sm font-bold shadow hover:bg-primary-50 transition active:scale-95"
                          >
                            ✓ Approve
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
