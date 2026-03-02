import React, { useState, useEffect } from "react";
import MainLayout from "../../layouts/MainLayout";
import CryptoJS from "crypto-js";
import { getReadOnlyContract, getSignerContract } from "../../utils/web3";

export default function RekamMedis() {
  const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
  const userWallet = (localStorage.getItem('user_wallet') || '').toLowerCase();

  const [activeTab, setActiveTab] = useState("pasien");

  const [consentedPatients, setConsentedPatients] = useState([]);
  const [patientProfiles, setPatientProfiles] = useState({});
  const [isFetchingPatients, setIsFetchingPatients] = useState(false);

  const [records, setRecords] = useState([]);
  const [isFetching, setIsFetching] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

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
      fetchConsentedPatients();
      fetchRecordsFromBlockchain();
    }
  }, [userWallet]);

  const fetchConsentedPatients = async () => {
    setIsFetchingPatients(true);
    try {
      const contract = getReadOnlyContract();
      const patients = await contract.getPatientsForDoctor(userWallet);
      setConsentedPatients(patients);

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
      if (total === 0) { setRecords([]); return; }

      const myRecords = [];
      for (let i = 1; i <= total; i++) {
        try {
          const [encryptedData, patientAddress, uploader, timestamp] = await contract.getMedicalRecord(i);
          if (uploader.toLowerCase() !== userWallet) continue;

          const decryptKey = patientAddress.toLowerCase();
          try {
            const bytes = CryptoJS.AES.decrypt(encryptedData, decryptKey);
            const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
            const decryptedData = JSON.parse(decryptedString);
            myRecords.push({
              id: i, patientAddress, uploader,
              timestamp: new Date(timestamp.toNumber() * 1000),
              ...decryptedData
            });
          } catch {
            console.warn(`Record #${i} gagal didekripsi.`);
          }
        } catch (err) {
          console.warn(`Gagal baca record #${i}:`, err);
        }
      }

      myRecords.sort((a, b) => b.timestamp - a.timestamp);
      setRecords(myRecords);
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

  const handleSimpanKeBlockchain = async () => {
    if (!patientWallet || !formData.diagnosis || !formData.gejala || !formData.obat || !formData.kondisiKhusus) {
      alert("Harap lengkapi semua field yang bertanda bintang (*).");
      return;
    }
    if (!patientWallet.startsWith("0x") || patientWallet.length !== 42) {
      alert("Format Wallet Address Pasien tidak valid!");
      return;
    }

    const isConsented = consentedPatients.some(
      p => p.toLowerCase() === patientWallet.toLowerCase()
    );
    if (!isConsented) {
      alert("❌ Pasien belum memberikan izin kepada Anda. Rekam medis tidak bisa ditambahkan.");
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

      const cipherText = CryptoJS.AES.encrypt(
        JSON.stringify(medicalDataObj),
        patientWallet.toLowerCase()
      ).toString();

      const contract = await getSignerContract();

      const tx = await contract.addMedicalRecord(patientWallet, cipherText);
      alert("Memproses transaksi... Mohon tunggu.");
      await tx.wait();
      alert("✅ Rekam medis berhasil disimpan ke Blockchain!");

      setIsFormOpen(false);
      setFormData({ diagnosis: "", gejala: "", obat: "", kondisiKhusus: "", catatanTambahan: "" });
      setPatientWallet("");
      fetchRecordsFromBlockchain();
    } catch (error) {
      console.error("Gagal simpan:", error);
      if (error.message?.includes("belum memberikan izin")) {
        alert("❌ Pasien belum memberikan izin. Minta pasien untuk memberi izin di halaman Daftar Dokter.");
      } else {
        alert("❌ Gagal menyimpan. Lihat console untuk detail.");
      }
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
                  <p className="font-semibold text-gray-800">{selectedRecord.dokterName || "-"}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Tanggal</p>
                  <p className="font-semibold text-gray-800">{formatTanggal(selectedRecord.timestamp)}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-5 border border-blue-100 col-span-full">
                  <p className="text-xs text-blue-500 mb-1 uppercase tracking-wide font-semibold">Wallet Pasien</p>
                  <p className="text-gray-800 font-mono text-sm break-all">{selectedRecord.patientAddress}</p>
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
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Obat / Herbal</p>
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
                              {p ? `${p.name} (${norm.substring(0, 6)}...${norm.slice(-4)})` : `${norm.substring(0, 6)}...${norm.slice(-4)}`}
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
                      ⚠️ Belum ada pasien yang memberikan izin kepada Anda. Minta pasien untuk membuka halaman <strong>Daftar Dokter</strong> dan klik "Beri Izin".
                    </div>
                  )}
                  {patientWallet && (
                    <p className="text-xs font-mono text-gray-400 mt-2 break-all">Wallet: {patientWallet}</p>
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
                    Obat / Terapi Herbal <span className="text-red-500">*</span>
                  </label>
                  <input type="text" name="obat" value={formData.obat} onChange={handleInputChange}
                    placeholder="Contoh: Jahe Merah, Kunyit, Temulawak..."
                    className="w-full p-4 bg-transparent border border-gray-200 rounded-xl focus:border-primary-40 focus:ring-1 focus:ring-primary-40 outline-none transition" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Kondisi Khusus <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select name="kondisiKhusus" value={formData.kondisiKhusus} onChange={handleInputChange}
                      className="w-full p-4 bg-transparent border border-gray-200 rounded-xl focus:border-primary-40 focus:ring-1 focus:ring-primary-40 outline-none transition appearance-none">
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
                  onClick={handleSimpanKeBlockchain}
                  disabled={isLoading || !patientWallet || consentedPatients.length === 0}
                  className={`${
                    isLoading || !patientWallet || consentedPatients.length === 0
                      ? "bg-gray-300 cursor-not-allowed"
                      : "bg-primary-40 hover:bg-primary-50"
                  } text-white px-10 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform active:scale-95`}
                >
                  {isLoading ? "⏳ Mengamankan Data... Tunggu MetaMask" : "🔒 Simpan & Enkripsi ke Blockchain"}
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
                  onClick={() => setActiveTab("rekam")}
                  className={`pb-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
                    activeTab === "rekam"
                      ? "border-primary-40 text-primary-40"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  📋 Riwayat Rekam Medis
                  {records.length > 0 && (
                    <span className="ml-2 bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                      {records.length}
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
                      <p className="text-gray-400 text-sm mt-1">Minta pasien untuk membuka halaman <strong>Daftar Dokter</strong> dan klik "Beri Izin"</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {consentedPatients.map((wallet) => {
                        const norm = wallet.toLowerCase();
                        const p = patientProfiles[norm];
                        return (
                          <div key={wallet} className="border border-green-100 bg-green-50 rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-11 h-11 rounded-full bg-white border border-green-200 flex items-center justify-center text-lg">
                                🧑
                              </div>
                              <div>
                                <p className="font-semibold text-gray-800">{p?.name || "Pasien"}</p>
                                <p className="text-xs font-mono text-gray-400">
                                  {norm.substring(0, 6)}...{norm.slice(-4)}
                                </p>
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
                      <p className="text-gray-400 text-sm mt-1">Tambahkan rekam medis dari tab "Pasien Saya"</p>
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
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </MainLayout>
  );
}