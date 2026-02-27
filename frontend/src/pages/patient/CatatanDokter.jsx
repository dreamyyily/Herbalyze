import React, { useState, useEffect } from "react";
import MainLayout from "../../layouts/MainLayout";
import { ethers } from "ethers";
import CryptoJS from "crypto-js";

const CONTRACT_ADDRESS = "0x70292603c3eF58A92099f6f6F94696f0bb5f3938";
const CONTRACT_ABI = [
  "function getMedicalRecord(uint256 _recordId) public view returns (string memory encryptedData, address patientAddress, address uploader, uint256 timestamp)",
  "function recordCount() public view returns (uint256)",
];

export default function CatatanDokter() {
  const userWallet = (localStorage.getItem('user_wallet') || '').toLowerCase();

  const [records, setRecords] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    if (userWallet) {
      fetchRecordsFromBlockchain();
    }
  }, [userWallet]);

  const getProvider = () => {
    return new ethers.providers.JsonRpcProvider("http://127.0.0.1:7545");
  };

  const fetchRecordsFromBlockchain = async () => {
    if (!userWallet) return;
    setIsFetching(true);
    try {
      const provider = getProvider();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

      const totalCount = await contract.recordCount();
      const total = totalCount.toNumber();

      if (total === 0) {
        setRecords([]);
        return;
      }

      const myRecords = [];

      for (let i = 1; i <= total; i++) {
        try {
          const [encryptedData, patientAddress, uploader, timestamp] = await contract.getMedicalRecord(i);

          const isMyRecord = patientAddress.toLowerCase() === userWallet;

          if (isMyRecord) {
            const decryptKey = patientAddress.toLowerCase();

            try {
              const bytes = CryptoJS.AES.decrypt(encryptedData, decryptKey);
              const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
              const decryptedData = JSON.parse(decryptedString);

              myRecords.push({
                id: i,
                patientAddress,
                uploader,
                timestamp: new Date(timestamp.toNumber() * 1000),
                ...decryptedData
              });
            } catch (decryptErr) {
              console.warn(`Record #${i} tidak bisa didekripsi.`);
            }
          }
        } catch (recordErr) {
          console.warn(`Gagal membaca record #${i}:`, recordErr);
        }
      }

      myRecords.sort((a, b) => b.timestamp - a.timestamp);
      setRecords(myRecords);

    } catch (err) {
      console.error("Gagal mengambil data dari blockchain:", err);
    } finally {
      setIsFetching(false);
    }
  };

  const filteredRecords = records.filter(r =>
    (r.diagnosis || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.dokterName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.obat || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTanggal = (date) => {
    return new Date(date).toLocaleDateString("id-ID", {
      day: "2-digit", month: "long", year: "numeric"
    });
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 mt-16 pb-20">

        {!selectedRecord && (
          <div className="text-center mb-10">
            <h1 className="text-2xl font-bold text-dark-50 mb-2">Catatan Dokter</h1>
            <p className="text-gray-500">Rekam medis terenkripsi yang tersimpan aman di Blockchain</p>
          </div>
        )}

        <div className="bg-white rounded-[2rem] shadow-sm p-10 border border-gray-100">

          {/* ── TAMPILAN DETAIL RECORD ── */}
          {selectedRecord && (
            <div className="animate-fade-in">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold text-dark-50">Detail Catatan Medis</h2>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="text-blue-500 font-medium hover:underline"
                >
                  ← Kembali ke Daftar
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Dokter</p>
                  <p className="font-semibold text-gray-800">{selectedRecord.dokterName || "-"}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Tanggal</p>
                  <p className="font-semibold text-gray-800">{formatTanggal(selectedRecord.timestamp)}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-5 border border-green-100 col-span-full">
                  <p className="text-xs text-green-500 mb-1 uppercase tracking-wide font-semibold">Diagnosis Penyakit</p>
                  <p className="text-gray-800">{selectedRecord.diagnosis || "-"}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 col-span-full">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Gejala yang Dialami</p>
                  <p className="text-gray-800">{selectedRecord.gejala || "-"}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Obat / Terapi Herbal</p>
                  <p className="font-semibold text-gray-800">{selectedRecord.obat || "-"}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Kondisi Khusus</p>
                  <p className="font-semibold text-gray-800">{selectedRecord.kondisiKhusus || "-"}</p>
                </div>
                {selectedRecord.catatanTambahan && (
                  <div className="bg-yellow-50 rounded-xl p-5 border border-yellow-100 col-span-full">
                    <p className="text-xs text-yellow-600 mb-1 uppercase tracking-wide">Catatan Tambahan</p>
                    <p className="text-gray-800">{selectedRecord.catatanTambahan}</p>
                  </div>
                )}
                <div className="col-span-full bg-blue-50 rounded-xl p-5 border border-blue-100">
                  <p className="text-xs text-blue-400 mb-1 uppercase tracking-wide">🔒 Verifikasi Blockchain</p>
                  <p className="text-xs text-gray-500 break-all">Record ID #{selectedRecord.id} · Uploader: {selectedRecord.uploader}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── TAMPILAN TABEL RIWAYAT ── */}
          {!selectedRecord && (
            <>
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-lg font-bold text-dark-50">Riwayat Catatan Medis</h2>
                <div className="flex items-center gap-4">
                  <input
                    type="text"
                    placeholder="Cari diagnosis / dokter..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-4 pr-4 py-2.5 bg-gray-50 rounded-full border border-gray-200 focus:outline-none text-sm w-64"
                  />
                  <button
                    onClick={fetchRecordsFromBlockchain}
                    disabled={isFetching}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2.5 rounded-full text-sm font-medium transition flex items-center gap-2"
                  >
                    {isFetching ? "⏳ Memuat..." : "🔄 Refresh"}
                  </button>
                </div>
              </div>

              {isFetching ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-40 mb-4"></div>
                  <p className="text-gray-400">Mengambil data dari Blockchain...</p>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                  <p className="text-4xl mb-3">📋</p>
                  <p className="text-gray-500 font-medium">Belum ada catatan medis</p>
                  <p className="text-gray-400 text-sm mt-1">Dokter belum menambahkan catatan untuk Anda</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Tanggal</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Dokter</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Diagnosis</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Obat / Herbal</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Kondisi</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((record) => (
                        <tr key={record.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                          <td className="py-4 px-4 text-gray-600">{formatTanggal(record.timestamp)}</td>
                          <td className="py-4 px-4 font-medium text-gray-800">{record.dokterName || "-"}</td>
                          <td className="py-4 px-4 text-gray-600 max-w-[200px] truncate">{record.diagnosis || "-"}</td>
                          <td className="py-4 px-4 text-gray-600 max-w-[150px] truncate">{record.obat || "-"}</td>
                          <td className="py-4 px-4">
                            <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
                              {record.kondisiKhusus || "Normal"}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <button
                              onClick={() => setSelectedRecord(record)}
                              className="text-primary-40 hover:underline font-medium text-sm"
                            >
                              Lihat Detail
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </MainLayout>
  );
}