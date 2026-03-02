import React, { useState, useEffect } from "react";
import MainLayout from "../../layouts/MainLayout";
import { ethers } from "ethers";
import CryptoJS from "crypto-js";

const CONTRACT_ADDRESS = "0x88A7ABC3ebC0525761E324F1E85a64787fCdFB9d";
const CONTRACT_ABI = [
  "function addMedicalRecord(address _patientAddress, string memory _encryptedData) public",
  "function getMedicalRecord(uint256 _recordId) public view returns (string memory encryptedData, address patientAddress, address uploader, uint256 timestamp)",
  "function recordCount() public view returns (uint256)",
  "event MedicalRecordAdded(uint256 indexed recordId, address indexed patientAddress, address indexed uploader, uint256 timestamp)"
];

export default function RekamMedis() {
  const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
  const userWallet = (localStorage.getItem('user_wallet') || '').toLowerCase();

  const [records, setRecords] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [patientWallet, setPatientWallet] = useState("");
  const [formData, setFormData] = useState({
    diagnosis: "",
    gejala: "",
    obat: "",
    kondisiKhusus: "",
    catatanTambahan: ""
  });

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

          // Dokter hanya melihat record yang dia upload
          const isDoctorRecord = uploader.toLowerCase() === userWallet;

          if (isDoctorRecord) {
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSimpanKeBlockchain = async () => {
    if (!patientWallet || !formData.diagnosis || !formData.gejala || !formData.obat || !formData.kondisiKhusus) {
      alert("Harap lengkapi semua field yang bertanda bintang (*), termasuk Wallet Pasien.");
      return;
    }

    if (!patientWallet.startsWith("0x") || patientWallet.length !== 42) {
      alert("Format Wallet Address Pasien tidak valid! Harus dimulai dengan 0x dan terdiri dari 42 karakter.");
      return;
    }

    try {
      setIsLoading(true);

      const medicalDataObj = {
        diagnosis: formData.diagnosis,
        gejala: formData.gejala,
        obat: formData.obat,
        kondisiKhusus: formData.kondisiKhusus,
        catatanTambahan: formData.catatanTambahan,
        dokterName: profile.nama || "Dokter Anonim",
        instansi: profile.instansi || "Rumah Sakit"
      };

      const jsonString = JSON.stringify(medicalDataObj);
      const cipherText = CryptoJS.AES.encrypt(jsonString, patientWallet.toLowerCase()).toString();

      if (!window.ethereum) throw new Error("MetaMask tidak terdeteksi!");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();

      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.addMedicalRecord(patientWallet, cipherText);

      alert("Memproses transaksi ke jaringan Blockchain... Mohon tunggu.");
      await tx.wait();

      alert("✅ Sukses! Data Berhasil Disimpan & Dienkripsi ke Blockchain.");

      setIsFormOpen(false);
      setFormData({ diagnosis: "", gejala: "", obat: "", kondisiKhusus: "", catatanTambahan: "" });
      setPatientWallet("");
      fetchRecordsFromBlockchain();

    } catch (error) {
      console.error("Gagal menyimpan ke blockchain:", error);
      if (error.message?.includes("Akses ditolak")) {
        alert("❌ Akses Ditolak: Akun dokter belum disetujui oleh Admin di Smart Contract.");
      } else {
        alert("❌ Gagal menyimpan data ke Blockchain. Lihat console untuk detail.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRecords = records.filter(r =>
    (r.diagnosis || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.dokterName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.obat || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.patientAddress || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTanggal = (date) => {
    return new Date(date).toLocaleDateString("id-ID", {
      day: "2-digit", month: "long", year: "numeric"
    });
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 mt-16 pb-20">

        {!isFormOpen && !selectedRecord && (
          <div className="text-center mb-10">
            <h1 className="text-2xl font-bold text-dark-50 mb-2">Rekam Medis Pasien</h1>
            <p className="text-gray-500">Catatan medis yang telah Anda tambahkan, tersimpan aman di Blockchain</p>
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
                <div className="bg-blue-50 rounded-xl p-5 border border-blue-100 col-span-full">
                  <p className="text-xs text-blue-500 mb-1 uppercase tracking-wide font-semibold">Wallet Pasien</p>
                  <p className="text-gray-800 font-mono text-sm break-all">{selectedRecord.patientAddress || "-"}</p>
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
          {!isFormOpen && !selectedRecord && (
            <>
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-lg font-bold text-dark-50">Riwayat Catatan Medis Pasien</h2>
                <div className="flex items-center gap-4">
                  <input
                    type="text"
                    placeholder="Cari diagnosis / pasien..."
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
                  <button
                    onClick={() => setIsFormOpen(true)}
                    className="bg-primary-40 hover:bg-primary-50 text-white px-6 py-2.5 rounded-full font-semibold transition flex items-center gap-2 text-sm"
                  >
                    <span>+</span> Tambah Catatan Baru
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
                  <p className="text-gray-400 text-sm mt-1">Tambahkan catatan baru untuk pasien Anda</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Tanggal</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Wallet Pasien</th>
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
                          <td className="py-4 px-4 font-mono text-gray-500 text-xs">
                            {record.patientAddress
                              ? record.patientAddress.substring(0, 6) + '...' + record.patientAddress.slice(-4)
                              : "-"}
                          </td>
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

          {/* ── FORM TAMBAH CATATAN ── */}
          {isFormOpen && (
            <div className="animate-fade-in">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold text-dark-50">Tambah Catatan Medis Baru</h2>
                <button className="text-blue-500 font-medium hover:underline" onClick={() => setIsFormOpen(false)}>
                  Batalkan
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Wallet Address Pasien <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={patientWallet}
                    onChange={(e) => setPatientWallet(e.target.value)}
                    placeholder="0x..."
                    className="w-full p-4 bg-transparent border border-gray-200 rounded-xl focus:border-primary-40 focus:ring-1 focus:ring-primary-40 outline-none transition font-mono text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">Digunakan sebagai kunci enkripsi data medis.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Diagnosis Penyakit <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="diagnosis"
                    value={formData.diagnosis}
                    onChange={handleInputChange}
                    placeholder="Tulis diagnosis penyakit pasien..."
                    className="w-full p-4 bg-transparent border border-gray-200 rounded-xl focus:border-primary-40 focus:ring-1 focus:ring-primary-40 outline-none transition min-h-[100px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Gejala yang Dialami <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="gejala"
                    value={formData.gejala}
                    onChange={handleInputChange}
                    placeholder="Tulis gejala yang dialami pasien..."
                    className="w-full p-4 bg-transparent border border-gray-200 rounded-xl focus:border-primary-40 focus:ring-1 focus:ring-primary-40 outline-none transition min-h-[100px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Obat / Terapi Herbal yang Diresepkan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="obat"
                    value={formData.obat}
                    onChange={handleInputChange}
                    placeholder="Contoh: Jahe Merah, Kunyit, Temulawak..."
                    className="w-full p-4 bg-transparent border border-gray-200 rounded-xl focus:border-primary-40 focus:ring-1 focus:ring-primary-40 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Kondisi Khusus <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      name="kondisiKhusus"
                      value={formData.kondisiKhusus}
                      onChange={handleInputChange}
                      className="w-full p-4 bg-transparent border border-gray-200 rounded-xl focus:border-primary-40 focus:ring-1 focus:ring-primary-40 outline-none transition appearance-none"
                    >
                      <option value="" disabled>Pilih Kondisi Khusus</option>
                      <option value="Ibu Hamil">Ibu Hamil</option>
                      <option value="Ibu Menyusui">Ibu Menyusui</option>
                      <option value="Anak-Anak">Anak-Anak</option>
                      <option value="Lansia">Lansia</option>
                      <option value="Hipertensi">Hipertensi</option>
                      <option value="Diabetes">Diabetes</option>
                      <option value="Alergi Spesifik">Alergi Spesifik</option>
                      <option value="Tidak Ada">Tidak Ada</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-500">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                      </svg>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                    <span>Catatan Tambahan</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">Opsional</span>
                  </label>
                  <textarea
                    name="catatanTambahan"
                    value={formData.catatanTambahan}
                    onChange={handleInputChange}
                    placeholder="Catatan tambahan untuk pasien..."
                    className="w-full p-4 bg-transparent border border-gray-200 rounded-xl focus:border-primary-40 focus:ring-1 focus:ring-primary-40 outline-none transition min-h-[100px]"
                  />
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleSimpanKeBlockchain}
                  disabled={isLoading}
                  className={`${
                    isLoading ? "bg-gray-400 cursor-not-allowed" : "bg-primary-40 hover:bg-primary-50"
                  } text-white px-10 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform active:scale-95`}
                >
                  {isLoading ? "⏳ Mengamankan Data... Tunggu MetaMask" : "🔒 Simpan & Enkripsi ke Blockchain"}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </MainLayout>
  );
}