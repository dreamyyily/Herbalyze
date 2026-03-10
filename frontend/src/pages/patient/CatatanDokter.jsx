import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../../layouts/MainLayout";
import CryptoJS from "crypto-js";
import { getReadOnlyContract } from "../../utils/web3";
import Avatar from "../../components/Avatar";

export default function CatatanDokter() {
  const userWallet = (localStorage.getItem('user_wallet') || '').toLowerCase();
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    if (userWallet) {
      fetchRecordsFromBlockchain();
    }
  }, [userWallet]);

  const fetchRecordsFromBlockchain = async () => {
    if (!userWallet) return;
    setIsFetching(true);
    try {
      const contract = getReadOnlyContract();
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

  // --- FUNGSI BARU: PERSIAPAN DATA UNTUK SBERT ---
  const handleCariRekomendasiAI = (record) => {
    // 1. Gabungkan diagnosis dan gejala menjadi kalimat utuh untuk dibaca SBERT
    const diagText = record.diagnosis ? record.diagnosis.trim() : "";
    const gejalaText = record.gejala ? record.gejala.trim() : "";
    
    let combinedTextForSbert = diagText;
    if (gejalaText) {
      combinedTextForSbert += `. Pasien juga mengeluhkan: ${gejalaText}`;
    }

    // 2. Lempar ke halaman Home dengan membawa instruksi "Mode SBERT"
    navigate("/ai-search", {
      state: {
        useSbertMode: true, 
        sbertQuery: combinedTextForSbert, 
        kondisiKhusus: record.kondisiKhusus 
      }
    });
  };

  const filteredRecords = records.filter(r =>
    (r.diagnosis || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.dokterName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.obat || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTanggal = (date) => {
    return new Date(date).toLocaleDateString("id-ID", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric"
    });
  };

  return (
    <MainLayout>
      <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-blue-50/50 to-transparent -z-10" />

      <div className="max-w-6xl mx-auto px-4 mt-16 pb-24 relative z-10">
        
        {!selectedRecord && (
          <div className="text-center mb-12 animate-fade-in">
            <span className="bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase mb-4 inline-block">Privasi Terjamin</span>
            <h1 className="text-3xl md:text-4xl font-extrabold text-dark-50 mb-3">Catatan Medis Anda</h1>
            <p className="text-gray-500 max-w-xl mx-auto">Semua rekam medis di bawah ini dienkripsi dan tersimpan secara permanen & aman di dalam jaringan Web3 Blockchain.</p>
          </div>
        )}

        <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
          
          {/* TAMPILAN DETAIL RECORD */}
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
                      <p className="text-[10px] font-mono text-blue-600/80 mt-0.5 break-all max-w-[200px]">By: {selectedRecord.uploader.substring(0,12)}...</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
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
              </div>
            </div>
          )}

          {/* TAMPILAN TABEL RIWAYAT (DENGAN TOMBOL AI DI DEPAN)   */}
          {!selectedRecord && (
            <div className="p-8 md:p-10">
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
                  <p className="text-gray-400 text-sm mt-1 max-w-sm text-center">Rekam medis Anda akan muncul di sini setelah dokter yang Anda beri izin menambahkannya.</p>
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
      </div>
    </MainLayout>
  );
}