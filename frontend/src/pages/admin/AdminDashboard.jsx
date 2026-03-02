import React, { useEffect, useState } from "react";
import MainLayout from "../../layouts/MainLayout";
import { getSignerContract, getSigner } from "../../utils/web3";

export default function AdminDashboard() {
  const [pendingDoctors, setPendingDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState({});

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
    const confirmation = window.confirm(
      `Apakah Anda yakin data atas nama ${nama} VALID?\n\nMetaMask akan terbuka untuk menandatangani transaksi approveUser() di Smart Contract.`
    );
    if (!confirmation) return;

    setApproving((prev) => ({ ...prev, [walletAddress]: true }));

    try {
      // === LANGKAH 1: Panggil Smart Contract via MetaMask ===
      const signer = await getSigner();
      const signerAddress = await signer.getAddress();
      const contract = await getSignerContract();
      const isAdminOnChain = await contract.isAdmin(signerAddress);
      if (!isAdminOnChain) {
        throw new Error(`Akun MetaMask Anda (${signerAddress.substring(0, 8)}...) bukan Admin di Smart Contract! Gunakan akun yang men-deploy kontrak.`);
      }

      // Panggil approveUser di blockchain
      const tx = await contract.approveUser(walletAddress);
      await tx.wait(); // Tunggu konfirmasi blockchain
      console.log("✅ approveUser berhasil di blockchain:", tx.hash);

      // === LANGKAH 2: Update status di Database ===
      const response = await fetch("http://localhost:8000/api/admin/approve_doctor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: walletAddress }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Gagal update database");

      alert(`✅ Sukses! ${nama} telah di-approve di Blockchain dan Database.\n\nTx Hash: ${tx.hash}`);
      fetchPendingDoctors();
    } catch (error) {
      console.error("Error approving:", error);
      const msg = error?.data?.message || error?.reason || error.message || "Terjadi kesalahan";
      alert("❌ Gagal approve: " + msg);
    } finally {
      setApproving((prev) => ({ ...prev, [walletAddress]: false }));
    }
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 mt-16 pb-12">
        <div className="mb-12">
          <h1 className="text-3xl font-extrabold text-dark-50">Dashboard Administrator</h1>
          <p className="text-dark-30 mt-2">Pusat kontrol dan verifikasi akses jaringan Blockchain Anda.</p>
        </div>

        {/* Info Box */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4 mb-8 flex items-start gap-3">
          <span className="text-xl mt-0.5">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-700">Penting: Hubungkan MetaMask dengan akun Admin</p>
            <p className="text-sm text-amber-600">
              Untuk meng-approve dokter, MetaMask Anda harus terhubung dengan akun yang <strong>men-deploy smart contract</strong> (akun pertama / akun Admin di Ganache).
              Proses approve akan memanggil <code className="bg-amber-100 px-1 rounded">approveUser()</code> di blockchain.
            </p>
          </div>
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
                            disabled={approving[doc.wallet_address]}
                            className="bg-primary-40 text-white px-6 py-2 rounded-xl text-sm font-bold shadow hover:bg-primary-50 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {approving[doc.wallet_address] ? "⏳ Memproses..." : "✓ Approve ke Blockchain"}
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

        {/* Panel Approve Pasien secara manual */}
        <div className="mt-8 bg-white rounded-3xl shadow-sm border border-light-40 p-8">
          <h2 className="text-xl font-bold text-dark-50 mb-2">Approve Wallet Pasien (Manual)</h2>
          <p className="text-sm text-dark-30 mb-4">
            Jika pasien tidak bisa melakukan consent karena belum di-approve, masukkan wallet address mereka di sini.
          </p>
          <ApprovePatientForm />
        </div>
      </div>
    </MainLayout>
  );
}

function ApprovePatientForm() {
  const [walletInput, setWalletInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprovePatient = async () => {
    const wallet = walletInput.trim();
    if (!wallet) return alert("Masukkan wallet address pasien terlebih dahulu.");
    if (!wallet.startsWith("0x") || wallet.length !== 42) {
      return alert("Format wallet address tidak valid! Harus diawali 0x dan 42 karakter.");
    }

    setIsProcessing(true);
    try {
      const signer = await getSigner();
      const signerAddress = await signer.getAddress();
      const contract = await getSignerContract();

      // ✅ Verifikasi bahwa akun MetaMask adalah Admin
      const isAdminCheck = await contract.isAdmin(signerAddress);
      if (!isAdminCheck) {
        alert(
          `❌ Akun MetaMask Anda bukan Admin!\n\n` +
          `Akun yang terhubung: ${signerAddress}\n\n` +
          `Silakan ganti ke akun pertama Ganache (yang digunakan saat deploy kontrak) di MetaMask.`
        );
        return;
      }

      // Cek apakah sudah di-approve
      const alreadyApproved = await contract.isApprovedUser(wallet);
      if (alreadyApproved) {
        alert(`ℹ️ Wallet ${wallet.substring(0,8)}... sudah di-approve sebelumnya.`);
        return;
      }

      const tx = await contract.approveUser(wallet);
      await tx.wait();
      alert(`✅ Wallet pasien berhasil di-approve di Blockchain!\nTx Hash: ${tx.hash}`);
      setWalletInput("");
    } catch (error) {
      console.error("Error approve pasien:", error);
      // Ekstrak pesan revert yang bermakna
      const revertReason =
        error?.data?.data?.reason ||
        error?.data?.reason ||
        error?.reason ||
        error?.error?.data?.reason ||
        error?.data?.message ||
        "";
      const errMsg = error?.message || "Terjadi kesalahan";
      const finalMsg = revertReason || errMsg;

      if (finalMsg.includes("Hanya Admin")) {
        alert("❌ Gagal: Akun MetaMask Anda bukan Admin di Smart Contract.\nGunakan akun pertama Ganache (akun deployer).");
      } else if (finalMsg.includes("network does not support ENS") || finalMsg.includes("unknown")) {
        alert("❌ Error jaringan: Pastikan MetaMask terhubung ke Ganache (localhost:7545, Chain ID: 1337).");
      } else {
        alert("❌ Gagal approve: " + finalMsg);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex gap-3 items-center">
      <input
        type="text"
        value={walletInput}
        onChange={(e) => setWalletInput(e.target.value)}
        placeholder="0x... (wallet address pasien)"
        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-30"
      />
      <button
        onClick={handleApprovePatient}
        disabled={isProcessing}
        className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow hover:bg-blue-700 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {isProcessing ? "⏳ Memproses..." : "🔐 Approve Pasien"}
      </button>
    </div>
  );
}
