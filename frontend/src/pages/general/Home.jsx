// ========================================================================
// 1. IMPORTS
// ========================================================================
import { useEffect, useState, useRef } from "react";

// Layout & Komponen Form Pendukung
import MainLayout from "../../layouts/MainLayout";
import SelectField from "../../components/SelectField";
import MultiSelectField from "../../components/MultiSelectField";

// Bagian UI Halaman Home
import HeroSection from "../../components/HeroSection";
import ResultSection from "../../components/ResultSection";

// ========================================================================
// 2. KOMPONEN UTAMA: HOME
// ========================================================================
export default function Home() {
  // --- STATE: Data Master dari API ---
  const [diagnosisOptions, setDiagnosisOptions] = useState([]);
  const [symptomOptions, setSymptomOptions] = useState([]);

  // --- STATE: Pilihan Pengguna (User Input) ---
  const [selectedDiagnoses, setSelectedDiagnoses] = useState([]);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [selectedCondition, setSelectedCondition] = useState([]);
  const [selectedDrug, setSelectedDrug] = useState([]);

  // --- STATE: UI Control (Loading, Error, Data Hasil) ---
  const [errorMessage, setErrorMessage] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Referensi untuk fitur Auto-Scroll ke bagian hasil
  const resultRef = useRef(null);

  // --- KONSTANTA: Opsi Statis ---
  const specialConditionOptions = ["Tidak ada", "Ibu hamil", "Ibu menyusui", "Anak di bawah lima tahun"];
  const chemicalDrugOptions = ["Tidak", "Ya"];

  // ========================================================================
  // 3. LIFECYCLE & API CALLS
  // ========================================================================
  // Berjalan 1 kali saat halaman pertama kali dimuat
  useEffect(() => {
    fetchDiagnoses();
    fetchSymptoms();
  }, []);

  // Mengambil daftar penyakit dari Backend
  const fetchDiagnoses = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/diagnoses");
      if (!res.ok) throw new Error("Gagal mengambil data diagnosis");
      const data = await res.json();
      setDiagnosisOptions(data);
    } catch (err) { 
      console.error("Error Fetch Diagnoses:", err); 
    }
  };

  // Mengambil daftar gejala dari Backend
  const fetchSymptoms = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/symptoms");
      if (!res.ok) throw new Error("Gagal mengambil data gejala");
      const data = await res.json();
      setSymptomOptions(data);
    } catch (err) { 
      console.error("Error Fetch Symptoms:", err); 
    }
  };

  // ========================================================================
  // 4. LOGIKA BISNIS (BUSINESS LOGIC)
  // ========================================================================
  
  /**
   * Mengatur pilihan Kondisi Khusus dengan cerdas.
   * Jika user memilih "Tidak ada", pilihan lain dibatalkan (Exclusive).
   */
  const handleConditionChange = (newArray) => {
    const exclusive = ["Tidak ada", "Anak di bawah lima tahun"];
    
    // Mencari item apa yang baru saja diklik oleh user
    const lastClicked = newArray.find((item) => !selectedCondition.includes(item)) || 
                        selectedCondition.find((item) => !newArray.includes(item));

    // Jika kosong (user menghapus semua pilihan)
    if (!lastClicked) {
      setSelectedCondition(newArray);
      return;
    }

    // Jika user mengklik opsi eksklusif (misal: "Tidak ada"), kosongkan yang lain
    if (exclusive.includes(lastClicked)) {
      setSelectedCondition([lastClicked]);
      return;
    }

    // Jika user mengklik "Ibu Hamil", pastikan "Tidak ada" dihapus dari daftar
    let cleaned = newArray.filter((item) => !exclusive.includes(item));
    setSelectedCondition(cleaned);
  };

  /**
   * Menangani proses validasi form dan pengiriman data ke AI (Backend)
   */
  const handleSearch = async () => {
    setErrorMessage(null); // Reset pesan error setiap kali tombol ditekan

    // --- VALIDASI LAPIS 1: Minimal 1 Penyakit/Gejala ---
    if (selectedDiagnoses.length === 0 && selectedSymptoms.length === 0) {
      setErrorMessage({ type: "Peringatan Medis", text: "Mohon pilih minimal satu 'Diagnosis Penyakit' atau 'Gejala Yang Dialami' agar AI dapat memberikan rekomendasi yang akurat." });
      return;
    }

    // --- VALIDASI LAPIS 2: Wajib isi Kondisi Khusus ---
    if (selectedCondition.length === 0) {
      setErrorMessage({ type: "Keamanan Pasien", text: "Mohon lengkapi bagian 'Kondisi Khusus'. Jika Anda tidak memiliki kondisi khusus, silakan pilih opsi 'Tidak ada'." });
      return;
    }

    // --- VALIDASI LAPIS 3: Wajib isi Interaksi Obat ---
    if (selectedDrug.length === 0) {
      setErrorMessage({ type: "Keamanan Pasien", text: "Mohon jawab apakah Anda sedang mengonsumsi Obat Kimia (Pilih Ya / Tidak) untuk mencegah interaksi obat yang berbahaya." });
      return;
    }
// Mengambil identitas user dari penyimpanan browser
    const userWallet = localStorage.getItem('user_wallet') || "guest_user"; 

    // Mempersiapkan paket data (Payload) lengkap untuk dikirim ke Backend
    const payload = { 
      wallet_address: userWallet,      // <-- IDENTITAS PASIEN DITAMBAHKAN
      diagnosis: selectedDiagnoses, 
      gejala: selectedSymptoms, 
      kondisi: selectedCondition,
      obat_kimia: selectedDrug         // <-- STATUS OBAT KIMIA DITAMBAHKAN
    };
    
    setIsLoading(true);
    setRecommendations(null); // Bersihkan hasil sebelumnya

    // Proses pengiriman ke Backend
    try {
      const res = await fetch("http://localhost:8000/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const results = await res.json();
      
      // Delay buatan (800ms) agar transisi UI terasa lebih natural
      setTimeout(() => {
        setRecommendations(results);
        setIsLoading(false);
        
        // Auto-Scroll presisi ke arah komponen hasil rekomendasi
        setTimeout(() => {
          if (resultRef.current) {
            resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      }, 800);
      
    } catch (err) {
      console.error("API Error:", err);
      setIsLoading(false);
    }
  };

  /**
   * Mengosongkan seluruh form dan mengembalikan layar ke posisi atas
   */
  const handleReset = () => {
    setSelectedDiagnoses([]); 
    setSelectedSymptoms([]);
    setSelectedCondition([]); 
    setSelectedDrug([]);
    setRecommendations(null);
    setErrorMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ========================================================================
  // 5. RENDER ANTARMUKA (UI / JSX)
  // ========================================================================
  return (
    <MainLayout>
      {/* Background Ornamen (Gradient Lingkaran di atas) */}
      <div className="absolute top-0 inset-x-0 h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-10/60 via-primary-10/30 to-transparent -z-10" />

      <div className="max-w-6xl mx-auto pt-10 md:pt-14 px-4 pb-24">
        
        {/* --- BAGIAN 1: JUDUL & DESKRIPSI UTAMA --- */}
        <HeroSection />

        {/* --- BAGIAN 2: KARTU FORMULIR DATA MEDIS --- */}
        <div className="bg-white rounded-[32px] shadow-[0_20px_50px_rgba(37,99,235,0.07)] border border-primary-10 overflow-hidden relative backdrop-blur-sm">
          
          {/* Header Kartu */}
          <div className="bg-primary-10/40 border-b border-light-40 px-8 py-6 md:px-10 md:py-8 flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-bold text-dark-50 flex items-center gap-4">
              <div className="p-2.5 bg-gradient-to-br from-primary-40 to-primary-60 rounded-xl shadow-lg shadow-primary-20 flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              Data Medis Pasien
            </h2>
          </div>

          {/* Isi Kartu (Grid Form) */}
          <div className="p-8 md:p-10 lg:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-14 gap-y-10">
              
              {/* Kolom Kiri: Input Penyakit & Gejala */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-8 h-[3px] bg-primary-40 rounded-full"></span>
                  <h3 className="text-primary-60 font-bold text-sm uppercase tracking-widest">Kondisi Kesehatan</h3>
                </div>
                <MultiSelectField label="Diagnosis Penyakit" options={diagnosisOptions} value={selectedDiagnoses} onChange={setSelectedDiagnoses} />
                <MultiSelectField label="Gejala Yang Dialami" options={symptomOptions} value={selectedSymptoms} onChange={setSelectedSymptoms} />
              </div>

              {/* Kolom Kanan: Input Kondisi Khusus & Obat */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-8 h-[3px] bg-primary-40 rounded-full"></span>
                  <h3 className="text-primary-60 font-bold text-sm uppercase tracking-widest">Profil Keamanan</h3>
                </div>
<MultiSelectField label="Kondisi Khusus" required options={specialConditionOptions} value={selectedCondition} onChange={handleConditionChange} />                <SelectField label="Konsumsi Obat Kimia" required options={chemicalDrugOptions} value={selectedDrug} onChange={(c) => setSelectedDrug([c])} closeOnSelect={true} />
              </div>
            </div>

            {/* Area Peringatan (Error Banner) - Muncul jika validasi gagal */}
            {errorMessage && (
              <div className="mt-10 p-5 bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-2xl flex items-start gap-4 animate-[fadeIn_0.3s_ease-out] shadow-sm">
                <div className="p-2.5 bg-red-100 rounded-full text-danger-30 flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <div>
                  <h4 className="text-base font-bold text-red-800 mb-1">{errorMessage.type}</h4>
                  <p className="text-sm text-red-700 leading-relaxed font-medium">{errorMessage.text}</p>
                </div>
              </div>
            )}

            {/* Area Tombol Aksi (Footer Kartu) */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mt-14 pt-8 border-t border-light-40">
              <span className="text-dark-30 text-sm font-medium flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-30" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                Data diproses secara rahasia & aman.
              </span>
              <div className="flex gap-4 w-full sm:w-auto">
                <button onClick={handleReset} disabled={isLoading} className="flex-1 sm:flex-none px-8 py-4 rounded-2xl font-bold text-dark-30 bg-light-20 hover:bg-red-50 hover:text-danger-30 transition-all disabled:opacity-50">
                  Reset Data
                </button>
                <button onClick={handleSearch} disabled={isLoading} className="flex-1 sm:flex-none bg-gradient-to-r from-primary-40 to-primary-60 text-white px-8 py-4 rounded-2xl font-bold hover:from-primary-50 hover:to-primary-70 hover:shadow-xl hover:shadow-primary-30/50 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-wait">
                  {isLoading ? "Menganalisis..." : "Cari Rekomendasi"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* --- BAGIAN 3: HASIL REKOMENDASI AI --- */}
        {/* Dibungkus div ref agar auto-scroll tahu di mana harus berhenti */}
        <div ref={resultRef} className="scroll-mt-10">
          <ResultSection recommendations={recommendations} selectedDrug={selectedDrug} />
        </div>
        
      </div>
    </MainLayout>
  );
}