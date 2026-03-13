import React, { useState, useEffect, useRef, useCallback } from "react";
import MainLayout from "../../layouts/MainLayout";
import CryptoJS from "crypto-js";
import { getReadOnlyContract, getSignerContract } from "../../utils/web3";
import Avatar from "../../components/Avatar";

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

const CONTRACT_ADDRESS = "0x88A7ABC3ebC0525761E324F1E85a64787fCdFB9d";
const CONTRACT_ABI = [
  "function addMedicalRecord(address _patientAddress, string memory _encryptedData) public",
  "function getMedicalRecord(uint256 _recordId) public view returns (string memory encryptedData, address patientAddress, address uploader, uint256 timestamp)",
  "function recordCount() public view returns (uint256)",
  "event MedicalRecordAdded(uint256 indexed recordId, address indexed patientAddress, address indexed uploader, uint256 timestamp)"
];

export default function RekamMedis() {
  const [profile, setProfile] = useState({});
  useEffect(() => {
    const wallet = localStorage.getItem("user_wallet");
    if (!wallet) return;
    
    fetch(`http://127.0.0.1:8000/api/profile/${wallet}`)
      .then(res => res.json())
      .then(data => {
        setProfile({ name: data.name, instansi: data.instansi || "Rumah Sakit" });
      })
      .catch(err => console.error("Gagal load profil dokter:", err));
  }, []);
  const userWallet = (localStorage.getItem('user_wallet') || '').toLowerCase();

  const [activeTab, setActiveTab] = useState("pasien");

  const specialConditionOptions = ["Tidak ada", "Ibu hamil", "Ibu menyusui", "Anak di bawah lima tahun"];

  const [consentedPatients, setConsentedPatients] = useState([]);
  const [patientProfiles, setPatientProfiles] = useState({});
  const [isFetchingPatients, setIsFetchingPatients] = useState(false);

  const [records, setRecords] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [newRecordsCount, setNewRecordsCount] = useState(0);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // toast notifikasi
  const [toasts, setToasts] = useState([]);

  const [patientWallet, setPatientWallet] = useState("");
  const [formData, setFormData] = useState({
    diagnosis: "",
    gejala: "",
    obat: "",
    kondisiKhusus: "",
    catatanTambahan: ""
  });

  // Ref untuk menyimpan jumlah consent sebelumnya (untuk deteksi perubahan)
  const prevConsentCountRef = useRef(null);
  const prevRecordCountRef = useRef(null);

  const showToast = useCallback((type, title, message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (userWallet) {
      fetchConsentedPatients();
      fetchRecordsFromBlockchain();
    }
  }, [userWallet]);

  // ── Polling otomatis setiap 30 detik ────────────────────────────────────────
  useEffect(() => {
    if (!userWallet) return;
    const interval = setInterval(async () => {
      // Cek consent pasien
      try {
        const contract = getReadOnlyContract();
        const patients = await contract.getPatientsForDoctor(userWallet);
        const uniquePatients = [...new Set(patients.map(p => p.toLowerCase()))];
        const prevCount = prevConsentCountRef.current;

        // Jika jumlah consent berkurang → pasien sudah approve & consent dicabut otomatis
        if (prevCount !== null && uniquePatients.length < prevCount) {
          setConsentedPatients(uniquePatients);
          await refreshBlockchainSilent();
        } else {
          setConsentedPatients(uniquePatients);
        }
        prevConsentCountRef.current = uniquePatients.length;
      } catch (err) {
        console.warn("Polling consent gagal:", err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [userWallet]);

  // Refresh blockchain records secara silent (tanpa loading spinner besar)
  const refreshBlockchainSilent = async () => {
    try {
      const contract = getReadOnlyContract();
      const totalCount = await contract.recordCount();
      const total = totalCount.toNumber();
      if (total === 0) return;

      const myRecords = [];
      for (let i = total; i >= Math.max(1, total - 50); i--) {
        try {
          const [encryptedData, patientAddress, , timestamp] = await contract.getMedicalRecord(i);
          const decryptKey = patientAddress.toLowerCase();
          try {
            const bytes = CryptoJS.AES.decrypt(encryptedData, decryptKey);
            const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
            if (!decryptedString) continue;
            const decryptedData = JSON.parse(decryptedString);

            if ((decryptedData.doctor_wallet || "").toLowerCase() !== userWallet) continue;

            myRecords.push({
              id: i, patientAddress,
              timestamp: new Date(timestamp.toNumber() * 1000),
              isNew: false,
              ...decryptedData
            });
          } catch { /* skip */ }
        } catch { /* skip */ }
      }

      myRecords.sort((a, b) => b.timestamp - a.timestamp);

      setRecords(prev => {
        const prevIds = new Set(prev.map(r => r.id));
        const newOnes = myRecords.filter(r => !prevIds.has(r.id));
        if (newOnes.length > 0) {
          setNewRecordsCount(c => c + newOnes.length);
          showToast("info", "Rekam Medis Baru", `${newOnes.length} rekam medis baru berhasil disimpan ke Blockchain oleh pasien!`);
          const merged = myRecords.map(r => ({
            ...r,
            isNew: newOnes.some(n => n.id === r.id)
          }));
          return merged;
        }
        return myRecords.length > 0 ? myRecords : prev;
      });
    } catch (err) {
      console.warn("Silent refresh gagal:", err);
    }
  };

  const fetchConsentedPatients = async () => {
    setIsFetchingPatients(true);
    try {
      const contract = getReadOnlyContract();
      const patients = await contract.getPatientsForDoctor(userWallet);
      const uniquePatients = [...new Set(patients.map(p => p.toLowerCase()))];
      setConsentedPatients(uniquePatients);
      prevConsentCountRef.current = uniquePatients.length;

      if (patients.length > 0) {
        await fetchPatientProfiles(patients);
      }
    } catch (err) {
      console.error("Gagal fetch pasien ber-consent:", err);
    } finally {
      setIsFetchingPatients(false);
    }
  };

  const fetchPatientProfiles = async (walletAddresses) => {
    try {
      const response = await fetch("http://localhost:8000/api/patients/by-wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallets: walletAddresses })
      });
      if (!response.ok) return;
      const data = await response.json();
      const map = {};
      (data.patients || []).forEach(p => {
        map[p.wallet_address.toLowerCase()] = p;
      });
      setPatientProfiles(map);
    } catch (err) {
      console.warn("Profil pasien tidak bisa diambil:", err);
    }
  };

  const fetchRecordsFromBlockchain = async () => {
    setIsFetching(true);
    try {
      const contract = getReadOnlyContract();

      const totalCount = await contract.recordCount();
      const total = totalCount.toNumber();
      if (total === 0) { setRecords([]); prevRecordCountRef.current = 0; return; }

      const myRecords = [];
      for (let i = 1; i <= total; i++) {
        try {
          const [encryptedData, patientAddress, uploader, timestamp] = await contract.getMedicalRecord(i);

          // Dekripsi menggunakan patientAddress sebagai key
          const decryptKey = patientAddress.toLowerCase();
          try {
            const bytes = CryptoJS.AES.decrypt(encryptedData, decryptKey);
            const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
            if (!decryptedString) continue;
            const decryptedData = JSON.parse(decryptedString);

            // Filter: hanya tampilkan rekam medis yang ditulis oleh dokter ini
            if ((decryptedData.doctor_wallet || "").toLowerCase() !== userWallet) continue;

            myRecords.push({
              id: i, patientAddress, uploader,
              timestamp: new Date(timestamp.toNumber() * 1000),
              isNew: false,
              ...decryptedData
            });
          } catch {
            // Record ini dienkripsi dengan key berbeda — skip
          }
        } catch (err) {
          console.warn(`Gagal baca record #${i}:`, err);
        }
      }

      myRecords.sort((a, b) => b.timestamp - a.timestamp);
      prevRecordCountRef.current = myRecords.length;
      setRecords(myRecords);
      setNewRecordsCount(0);
    } catch (err) {
      console.error("Gagal fetch blockchain:", err);
    } finally {
      setIsFetching(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddFromPatient = (wallet) => {
    setPatientWallet(wallet);
    setIsFormOpen(true);
    setActiveTab("rekam");
  };

  const handleSubmitDraft = async () => {
    if (!patientWallet || !formData.diagnosis || !formData.gejala || !formData.obat || !formData.kondisiKhusus) {
      showToast("error", "Validasi Gagal", "Harap lengkapi semua field yang bertanda bintang (*)");
      return;
    }
    if (!patientWallet.startsWith("0x") || patientWallet.length !== 42) {
      showToast("error", "Format Tidak Valid", "Format Wallet Address Pasien tidak valid!");
      return;
    }

    const isConsented = consentedPatients.some(
      p => p.toLowerCase() === patientWallet.toLowerCase()
    );
    if (!isConsented) {
      showToast("error", "Izin Ditolak", "Pasien belum memberikan izin kepada Anda. Rekam medis tidak bisa ditambahkan.");
      return;
    }

    try {
      setIsLoading(true);

      const payload = {
        patient_wallet: patientWallet.toLowerCase(),
        doctor_wallet: userWallet,
        doctor_name: profile.name || "Dokter Anonim",
        doctor_instansi: profile.nama_instansi || profile.instansi || "Rumah Sakit",
        record_data: {
          diagnosis: formData.diagnosis,
          gejala: formData.gejala,
          obat: formData.obat,
          kondisiKhusus: formData.kondisiKhusus,
          catatanTambahan: formData.catatanTambahan,
        }
      };

      const res = await fetch("http://localhost:8000/api/medical-record/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        showToast("error", "Gagal Submit", data.error || data.detail || "Terjadi kesalahan saat memproses data.");
        return;
      }

      showToast("success", "Draft Tersimpan!", "Rekam medis berhasil disimpan. Pasien akan mendapat notifikasi untuk memverifikasi data ini sebelum masuk ke Blockchain.");
      setIsFormOpen(false);
      setFormData({ diagnosis: "", gejala: "", obat: "", kondisiKhusus: "", catatanTambahan: "" });
      setPatientWallet("");
      fetchRecordsFromBlockchain();
      fetchConsentedPatients();
    } catch (error) {
      console.error("Gagal submit draft:", error);
      showToast("error", "Server Error", "Gagal menyimpan draft rekam medis. Cek koneksi server.");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRecords = records.filter(r =>
    (r.diagnosis || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.patientAddress || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.obat || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTanggal = (date) => new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit", month: "long", year: "numeric"
  });

  return (
    <MainLayout>
      {/* Toast Notifikasi */}
      <Toast toasts={toasts} removeToast={removeToast} />
      {/* Animasi toast */}
      <style>{`
        @keyframes slide-in-right {
          from { opacity: 0; transform: translateX(100px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in { animation: slide-in-right 0.4s cubic-bezier(.21,1.02,.73,1) both; }
      `}</style>
      <div className="max-w-6xl mx-auto px-4 mt-16 pb-20">

        {!isFormOpen && !selectedRecord && (
          <div className="text-center mb-10">
            <h1 className="text-2xl font-bold text-dark-50 mb-2">Rekam Medis Pasien</h1>
            <p className="text-gray-500">Kelola rekam medis pasien yang telah memberikan izin kepada Anda</p>
          </div>
        )}

        <div className="bg-white rounded-[2rem] shadow-sm p-10 border border-gray-100">

          {selectedRecord && (
            <div className="animate-fade-in">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold text-dark-50">Detail Catatan Medis</h2>
                <button onClick={() => setSelectedRecord(null)} className="text-blue-500 font-medium hover:underline">
                  ← Kembali
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Dokter</p>
                  <p className="font-semibold text-gray-800">{selectedRecord.dokterName || selectedRecord.doctor_name || "-"}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Tanggal</p>
                  <p className="font-semibold text-gray-800">{formatTanggal(selectedRecord.timestamp)}</p>
                </div>

                <div className="bg-green-50 rounded-xl p-5 border border-green-100 col-span-full">
                  <p className="text-xs text-green-500 mb-1 uppercase tracking-wide font-semibold">Diagnosis</p>
                  <p className="text-gray-800">{selectedRecord.diagnosis || "-"}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 col-span-full">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Gejala</p>
                  <p className="text-gray-800">{selectedRecord.gejala || "-"}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Resep Obat</p>
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

              </div>
            </div>
          )}

          {/* ── FORM TAMBAH ── */}
          {isFormOpen && (
            <div className="animate-fade-in">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold text-dark-50">Tambah Rekam Medis Baru</h2>
                <button
                  className="text-blue-500 font-medium hover:underline"
                  onClick={() => { setIsFormOpen(false); setPatientWallet(""); }}
                >
                  Batalkan
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Pilih Pasien <span className="text-red-500">*</span>
                  </label>
                  {consentedPatients.length > 0 ? (
                    <div className="relative">
                      <select
                        value={patientWallet}
                        onChange={(e) => setPatientWallet(e.target.value)}
                        className="w-full p-4 bg-transparent border border-gray-200 rounded-xl focus:border-primary-40 focus:ring-1 focus:ring-primary-40 outline-none transition appearance-none"
                      >
                        <option value="" disabled>-- Pilih pasien yang sudah memberi izin --</option>
                        {consentedPatients.map((wallet) => {
                          const norm = wallet.toLowerCase();
                          const p = patientProfiles[norm];
                          return (
                            <option key={wallet} value={wallet}>
                              {p ? p.name : `Pasien (${norm.substring(0, 6)}...${norm.slice(-4)})`}
                            </option>
                          );
                        })}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-500">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                        </svg>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-700">
                      ⚠️ Belum ada pasien yang memberikan izin kepada Anda. Minta pasien untuk membuka halaman <strong>Perizinan Dokter</strong> dan klik "Beri Izin".
                    </div>
                  )}

                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Diagnosis Penyakit <span className="text-red-500">*</span>
                  </label>
                  <textarea name="diagnosis" value={formData.diagnosis} onChange={handleInputChange}
                    placeholder="Tulis diagnosis penyakit pasien..."
                    className="w-full p-4 bg-transparent border border-gray-200 rounded-xl focus:border-primary-40 focus:ring-1 focus:ring-primary-40 outline-none transition min-h-[100px]" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Gejala yang Dialami <span className="text-red-500">*</span>
                  </label>
                  <textarea name="gejala" value={formData.gejala} onChange={handleInputChange}
                    placeholder="Tulis gejala yang dialami pasien..."
                    className="w-full p-4 bg-transparent border border-gray-200 rounded-xl focus:border-primary-40 focus:ring-1 focus:ring-primary-40 outline-none transition min-h-[100px]" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Resep Obat <span className="text-red-500">*</span>
                  </label>
                  <textarea name="obat" value={formData.obat} onChange={handleInputChange}
                    placeholder="Contoh: Paracetamol 500mg, Amoxicillin 3x1, atau herbal sesuai resep dokter..."
                    className="w-full p-4 bg-transparent border border-gray-200 rounded-xl focus:border-primary-40 focus:ring-1 focus:ring-primary-40 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Kondisi Khusus <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select name="kondisiKhusus" value={formData.kondisiKhusus} onChange={handleInputChange}
                      className="w-full p-4 bg-transparent border border-gray-200 rounded-xl focus:border-primary-40 focus:ring-1 focus:ring-primary-40 outline-none transition appearance-none"
                    >
                      <option value="" disabled>Pilih Kondisi Khusus</option>
                      {specialConditionOptions.map((option, index) => (
                        <option key={index} value={option}>{option}</option>
                      ))}
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
                    Catatan Tambahan
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">Opsional</span>
                  </label>
                  <textarea name="catatanTambahan" value={formData.catatanTambahan} onChange={handleInputChange}
                    placeholder="Catatan tambahan untuk pasien..."
                    className="w-full p-4 bg-transparent border border-gray-200 rounded-xl focus:border-primary-40 focus:ring-1 focus:ring-primary-40 outline-none transition min-h-[100px]" />
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleSubmitDraft}
                  disabled={isLoading || !patientWallet || consentedPatients.length === 0}
                  className={`${
                    isLoading || !patientWallet || consentedPatients.length === 0
                      ? "bg-gray-300 cursor-not-allowed"
                      : "bg-primary-40 hover:bg-primary-50"
                  } text-white px-10 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform active:scale-95`}
                >
                  {isLoading ? "⏳ Menyimpan Draft..." : "📋 Kirim ke Pasien untuk Diverifikasi"}
                </button>
              </div>
            </div>
          )}

          {!isFormOpen && !selectedRecord && (
            <>
              <div className="flex gap-2 mb-8 border-b border-gray-100">
                <button
                  onClick={() => setActiveTab("pasien")}
                  className={`pb-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
                    activeTab === "pasien"
                      ? "border-primary-40 text-primary-40"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  👥 Pasien Saya
                  {consentedPatients.length > 0 && (
                    <span className="ml-2 bg-primary-40 text-white text-xs px-2 py-0.5 rounded-full">
                      {consentedPatients.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => { setActiveTab("rekam"); setNewRecordsCount(0); }}
                  className={`pb-3 px-4 font-semibold text-sm border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === "rekam"
                      ? "border-primary-40 text-primary-40"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  📋 Riwayat Rekam Medis
                  {records.length > 0 && (
                    <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                      {records.length}
                    </span>
                  )}
                  {newRecordsCount > 0 && (
                    <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                      +{newRecordsCount} Baru!
                    </span>
                  )}
                </button>
              </div>

              {activeTab === "pasien" && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <p className="text-sm text-gray-500">Pasien yang telah memberikan izin kepada Anda</p>
                    <button
                      onClick={fetchConsentedPatients}
                      disabled={isFetchingPatients}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2.5 rounded-full text-sm font-medium transition flex items-center gap-2"
                    >
                      {isFetchingPatients ? "Memuat..." : "🔄 Refresh"}
                    </button>
                  </div>

                  {isFetchingPatients ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-40 mb-4"></div>
                      <p className="text-gray-400">Memuat daftar pasien...</p>
                    </div>
                  ) : consentedPatients.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                      <p className="text-4xl mb-3">🙋</p>
                      <p className="text-gray-500 font-medium">Belum ada pasien yang memberi izin</p>
                      <p className="text-gray-400 text-sm mt-1">Minta pasien untuk membuka halaman <strong>Perizinan Dokter</strong> dan klik "Beri Izin"</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {consentedPatients.map((wallet) => {
                        const norm = wallet.toLowerCase();
                        const p = patientProfiles[norm];
                        return (
                          <div key={wallet} className="border border-green-100 bg-green-50 rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-4">
                              <Avatar name={p?.name} fotoProfil={p?.foto_profil} size="md" />
                              <div>
                                <p className="font-semibold text-gray-800">{p?.name || "Pasien"}</p>
                              </div>
                              <span className="ml-auto bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                                ✓ Diizinkan
                              </span>
                            </div>
                            <button
                              onClick={() => handleAddFromPatient(wallet)}
                              className="w-full py-2.5 rounded-xl bg-primary-40 hover:bg-primary-50 text-white font-semibold text-sm transition"
                            >
                              + Tambah Rekam Medis
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: RIWAYAT REKAM MEDIS ── */}
              {activeTab === "rekam" && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <p className="text-sm text-gray-500">Semua rekam medis yang telah Anda tambahkan</p>
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
                      <p className="text-gray-500 font-medium">Belum ada rekam medis</p>
                      <p className="text-gray-400 text-sm mt-1">Rekam medis akan muncul di sini setelah pasien menyetujui</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-3 px-4 text-gray-400 font-medium">Tanggal</th>
                            <th className="text-left py-3 px-4 text-gray-400 font-medium">Pasien</th>
                            <th className="text-left py-3 px-4 text-gray-400 font-medium">Diagnosis</th>
                            <th className="text-left py-3 px-4 text-gray-400 font-medium">Resep Obat</th>
                            <th className="text-left py-3 px-4 text-gray-400 font-medium">Kondisi</th>
                            <th className="text-left py-3 px-4 text-gray-400 font-medium">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRecords.map((record) => (
                            <tr
                              key={record.id}
                              className={`border-b transition ${
                                record.isNew
                                  ? "border-green-100 bg-green-50 hover:bg-green-100"
                                  : "border-gray-50 hover:bg-gray-50"
                              }`}
                            >
                              <td className="py-4 px-4 text-gray-600">
                                {formatTanggal(record.timestamp)}
                                {record.isNew && (
                                  <span className="ml-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">Baru</span>
                                )}
                              </td>
                              <td className="py-4 px-4 text-gray-700 font-medium">
                                {patientProfiles[record.patientAddress?.toLowerCase()]?.name ||
                                  (record.patientAddress
                                    ? record.patientAddress.substring(0, 6) + '...' + record.patientAddress.slice(-4)
                                    : "-")}
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
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </MainLayout>
  );
}