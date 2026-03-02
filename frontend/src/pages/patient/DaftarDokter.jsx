import React, { useState, useEffect } from "react";
import MainLayout from "../../layouts/MainLayout";
import { getReadOnlyContract, getSignerContract } from "../../utils/web3";

export default function DaftarDokter() {
  const userWallet = (localStorage.getItem('user_wallet') || '').toLowerCase();

  const [doctors, setDoctors] = useState([]);
  const [consentMap, setConsentMap] = useState({});
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [loadingConsent, setLoadingConsent] = useState({});
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    setIsLoadingDoctors(true);
    try {
      const response = await fetch("http://localhost:8000/api/doctors");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal mengambil daftar dokter");

      setDoctors(data.doctors || []);

      // cek consent
      if (userWallet && data.doctors?.length > 0) {
        await checkAllConsents(data.doctors);
      }
    } catch (err) {
      console.error("Gagal fetch daftar dokter:", err);
    } finally {
      setIsLoadingDoctors(false);
    }
  };

  const checkAllConsents = async (doctorList) => {
    try {
      const contract = getReadOnlyContract();

      const results = await Promise.all(
        doctorList.map(async (doc) => {
          if (!doc.wallet_address) return [doc.wallet_address, false];
          try {
            const hasConsent = await contract.checkConsent(userWallet, doc.wallet_address.toLowerCase());
            return [doc.wallet_address.toLowerCase(), hasConsent];
          } catch {
            return [doc.wallet_address.toLowerCase(), false];
          }
        })
      );

      const map = {};
      results.forEach(([addr, val]) => { map[addr] = val; });
      setConsentMap(map);
    } catch (err) {
      console.error("Gagal cek consent:", err);
    }
  };

  const handleToggleConsent = async (doctorWallet) => {
    if (!doctorWallet) return;
    const normalizedDoctor = doctorWallet.toLowerCase();
    const currentConsent = consentMap[normalizedDoctor] || false;

    setLoadingConsent((prev) => ({ ...prev, [normalizedDoctor]: true }));
    try {
      const contract = await getSignerContract();

      let tx;
      if (currentConsent) {
        tx = await contract.revokeConsent(doctorWallet);
        await tx.wait();
        alert("✅ Izin berhasil dicabut dari dokter ini.");
      } else {
        tx = await contract.grantConsent(doctorWallet);
        await tx.wait();
        alert("✅ Izin berhasil diberikan! Dokter ini sekarang dapat mengisi rekam medis Anda.");
      }

      setConsentMap((prev) => ({ ...prev, [normalizedDoctor]: !currentConsent }));
    } catch (err) {
      console.error("Gagal mengubah consent:", err);
      // Ekstrak pesan revert dari error blockchain
      const revertReason =
        err?.data?.data?.reason ||
        err?.data?.reason ||
        err?.reason ||
        err?.error?.data?.reason ||
        "";
      const errMsg = err?.data?.message || err?.message || "";

      if (revertReason.includes("belum di-ACC") || errMsg.includes("belum di-ACC")) {
        alert(
          "❌ Akun Anda belum disetujui oleh Admin.\n\n" +
          "Wallet address Anda perlu di-approve terlebih dahulu oleh Administrator Herbalyze sebelum bisa memberikan izin ke dokter.\n\n" +
          "Hubungi admin untuk proses verifikasi."
        );
      } else if (revertReason.includes("Consent sudah diberikan") || errMsg.includes("Consent sudah diberikan")) {
        alert("ℹ️ Izin sudah diberikan sebelumnya.");
      } else if (revertReason.includes("Consent belum pernah") || errMsg.includes("Consent belum pernah")) {
        alert("ℹ️ Belum ada izin yang diberikan.");
      } else if (err.code === 4001) {
        alert("⚠️ Transaksi dibatalkan oleh pengguna.");
      } else {
        alert("❌ Gagal mengubah izin: " + (revertReason || errMsg || "Lihat console untuk detail."));
      }
    } finally {
      setLoadingConsent((prev) => ({ ...prev, [normalizedDoctor]: false }));
    }
  };

  const filteredDoctors = doctors.filter((doc) =>
    (doc.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (doc.instansi || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (doc.spesialisasi || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 mt-16 pb-20">

        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-dark-50 mb-2">Daftar Dokter Terverifikasi</h1>
          <p className="text-gray-500">Pilih dokter yang Anda percaya untuk mengakses rekam medis Anda</p>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-6 py-4 mb-8 flex items-start gap-3">
          <span className="text-xl mt-0.5">🔒</span>
          <div>
            <p className="text-sm font-semibold text-blue-700">Kontrol Penuh Ada di Tangan Anda</p>
            <p className="text-sm text-blue-600">
              Hanya dokter yang Anda beri izin yang dapat menambahkan catatan medis ke rekam medis Anda.
              Izin disimpan permanen di Blockchain dan dapat dicabut kapan saja.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] shadow-sm p-10 border border-gray-100">

          <div className="flex justify-between items-center mb-8">
            <h2 className="text-lg font-bold text-dark-50">
              Dokter Aktif
              {!isLoadingDoctors && (
                <span className="ml-2 text-sm font-normal text-gray-400">({filteredDoctors.length} dokter)</span>
              )}
            </h2>
            <div className="flex items-center gap-4">
              <input
                type="text"
                placeholder="Cari nama / instansi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-4 pr-4 py-2.5 bg-gray-50 rounded-full border border-gray-200 focus:outline-none text-sm w-64"
              />
              <button
                onClick={fetchDoctors}
                disabled={isLoadingDoctors}
                className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2.5 rounded-full text-sm font-medium transition flex items-center gap-2"
              >
                {isLoadingDoctors ? "Memuat..." : "🔄 Refresh"}
              </button>
            </div>
          </div>

          {isLoadingDoctors ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-40 mb-4"></div>
              <p className="text-gray-400">Memuat daftar dokter...</p>
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
              <p className="text-4xl mb-3">👨‍⚕️</p>
              <p className="text-gray-500 font-medium">Belum ada dokter terverifikasi</p>
              <p className="text-gray-400 text-sm mt-1">Tunggu hingga admin memverifikasi akun dokter</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDoctors.map((doc) => {
                const wallet = (doc.wallet_address || "").toLowerCase();
                const hasConsent = consentMap[wallet] || false;
                const isProcessing = loadingConsent[wallet] || false;

                return (
                  <div
                    key={doc.id || wallet}
                    className={`rounded-2xl border p-6 transition-all ${
                      hasConsent
                        ? "border-green-200 bg-green-50"
                        : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary-10 flex items-center justify-center text-xl">
                          👨‍⚕️
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{doc.name || "Dokter"}</p>
                          <p className="text-sm text-gray-500">{doc.instansi || "Instansi tidak tersedia"}</p>
                        </div>
                      </div>
                      {hasConsent && (
                        <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">
                          ✓ Diizinkan
                        </span>
                      )}
                    </div>

                    {doc.spesialisasi && (
                      <p className="text-xs text-gray-400 mb-1">
                        🏥 Spesialisasi: <span className="text-gray-600">{doc.spesialisasi}</span>
                      </p>
                    )}
                    {wallet && (
                      <p className="text-xs text-gray-400 mb-4 font-mono">
                        🔑 {wallet.substring(0, 6)}...{wallet.slice(-4)}
                      </p>
                    )}

                    <button
                      onClick={() => handleToggleConsent(doc.wallet_address)}
                      disabled={isProcessing || !wallet}
                      className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all ${
                        isProcessing
                          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                          : hasConsent
                          ? "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
                          : "bg-primary-40 hover:bg-primary-50 text-white shadow-sm"
                      }`}
                    >
                      {isProcessing
                        ? "Memproses di Blockchain..."
                        : hasConsent
                        ? "Cabut Izin"
                        : "Beri Izin"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}