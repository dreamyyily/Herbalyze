import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom"; // <-- TAMBAH useLocation
import { loadProfile } from "../../utils/storage";
import MainLayout from "../../layouts/MainLayout";
import SelectField from "../../components/SelectField";
import MultiSelectField from "../../components/MultiSelectField";
import HeroSection from "../../components/HeroSection";
import ResultSection from "../../components/ResultSection";

export default function Home() {
  const [diagnosisOptions, setDiagnosisOptions] = useState([]);
  const [symptomOptions, setSymptomOptions] = useState([]);

  const [selectedDiagnoses, setSelectedDiagnoses] = useState([]);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [selectedCondition, setSelectedCondition] = useState([]);
  const [selectedDrug, setSelectedDrug] = useState([]);

  const [errorMessage, setErrorMessage] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation(); // <-- UNTUK MENANGKAP PESAN SUKSES DARI HALAMAN LAIN
  const [showProfileWarning, setShowProfileWarning] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false); // <-- STATE TOAST SUKSES
  
  const resultRef = useRef(null);

  const specialConditionOptions = ["Tidak ada", "Ibu hamil", "Ibu menyusui", "Anak di bawah lima tahun"];
  const chemicalDrugOptions = ["Tidak", "Ya"];

  useEffect(() => {
    fetchDiagnoses();
    fetchSymptoms();

    const profile = loadProfile();
    const isProfileIncomplete =
      !profile || !profile.nik || !profile.nama || !profile.tanggalLahir || !profile.alergiHerbal?.length;

    if (isProfileIncomplete) {
      setShowProfileWarning(true);
    }

    // --- CEK APAKAH BARU SAJA BERHASIL UPDATE PROFIL DARI HALAMAN DATA PERSONAL ---
    if (location.state?.profileUpdated) {
      setShowProfileWarning(false); // Buka gembok form
      setShowSuccessToast(true);    // Tampilkan notifikasi sukses modern
      
      // Hilangkan state agar tidak muncul terus saat di-refresh
      window.history.replaceState({}, document.title);
      
      // Sembunyikan toast otomatis setelah 4 detik
      setTimeout(() => setShowSuccessToast(false), 4000); 
    }
  }, [location]);

  const fetchDiagnoses = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/diagnoses");
      if (!res.ok) throw new Error("Gagal mengambil data diagnosis");
      const data = await res.json();
      setDiagnosisOptions(data);
    } catch (err) { console.error("Error Fetch Diagnoses:", err); }
  };

  const fetchSymptoms = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/symptoms");
      if (!res.ok) throw new Error("Gagal mengambil data gejala");
      const data = await res.json();
      setSymptomOptions(data);
    } catch (err) { console.error("Error Fetch Symptoms:", err); }
  };

  const handleConditionChange = (newArray) => {
    const exclusive = ["Tidak ada", "Anak di bawah lima tahun"];
    const lastClicked = newArray.find((item) => !selectedCondition.includes(item)) || selectedCondition.find((item) => !newArray.includes(item));

    if (!lastClicked) { setSelectedCondition(newArray); return; }
    if (exclusive.includes(lastClicked)) { setSelectedCondition([lastClicked]); return; }

    let cleaned = newArray.filter((item) => !exclusive.includes(item));
    setSelectedCondition(cleaned);
  };

  const handleSearch = async () => {
    if (showProfileWarning) {
      // Lempar user ke Data Personal dengan membawa "Pesan Rahasia" (fromHomeLock: true)
      navigate("/data-personal", { state: { fromHomeLock: true } });
      return;
    }

    setErrorMessage(null); 

    if (selectedDiagnoses.length === 0 && selectedSymptoms.length === 0) {
      setErrorMessage({ type: "Peringatan Medis", text: "Mohon pilih minimal satu 'Diagnosis Penyakit' atau 'Gejala Yang Dialami'." });
      return;
    }
    if (selectedCondition.length === 0) {
      setErrorMessage({ type: "Keamanan Pasien", text: "Mohon lengkapi bagian 'Kondisi Khusus'." });
      return;
    }
    if (selectedDrug.length === 0) {
      setErrorMessage({ type: "Keamanan Pasien", text: "Mohon jawab apakah Anda sedang mengonsumsi Obat Kimia." });
      return;
    }

    const userWallet = localStorage.getItem('user_wallet') || "guest_user"; 
    const payload = { 
      wallet_address: userWallet, diagnosis: selectedDiagnoses, gejala: selectedSymptoms, kondisi: selectedCondition, obat_kimia: selectedDrug      
    };
    
    setIsLoading(true); setRecommendations(null);

    try {
      const res = await fetch("http://localhost:8000/api/recommend", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const results = await res.json();
      
      setTimeout(() => {
        setRecommendations(results); setIsLoading(false);
        setTimeout(() => { if (resultRef.current) resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
      }, 800);
      
    } catch (err) { console.error("API Error:", err); setIsLoading(false); }
  };

  const handleReset = () => {
    setSelectedDiagnoses([]); setSelectedSymptoms([]); setSelectedCondition([]); setSelectedDrug([]);
    setRecommendations(null); setErrorMessage(null); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <MainLayout>
      <div className="absolute top-0 inset-x-0 h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-10/60 via-primary-10/30 to-transparent -z-10" />

      {/* --- NOTIFIKASI TOAST MELAYANG (MUNCUL JIKA SUKSES DARI DATA PERSONAL) --- */}
      {showSuccessToast && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 animate-[slideDown_0.5s_ease-out]">
          <div className="bg-white px-6 py-4 rounded-2xl shadow-2xl border border-green-100 flex items-center gap-4">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
            <div>
              <h4 className="text-gray-800 font-bold text-sm">Profil Berhasil Dilengkapi!</h4>
              <p className="text-gray-500 text-xs mt-0.5">Formulir medis sekarang telah dibuka.</p>
            </div>
            <button onClick={() => setShowSuccessToast(false)} className="ml-4 text-gray-400 hover:text-gray-600">&times;</button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto pt-10 md:pt-14 px-4 pb-24">
        
        <HeroSection />

        <div className="bg-white rounded-[32px] shadow-[0_20px_50px_rgba(37,99,235,0.07)] border border-primary-10 overflow-hidden relative backdrop-blur-sm mt-6">
          
          {/* Overlay Kunci */}
          {showProfileWarning && (
            <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[3px] flex items-center justify-center rounded-[32px]">
               <div className="bg-white p-8 rounded-[2rem] shadow-2xl border border-gray-100 text-center max-w-md animate-fade-in transform transition-all">
                 <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 border-[8px] border-amber-50/50">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                 </div>
                 <h3 className="text-2xl font-bold text-gray-800 mb-3">Formulir Terkunci</h3>
                 <p className="text-sm text-gray-500 mb-8 leading-relaxed px-2">
                   Anda belum dapat mencari rekomendasi herbal sebelum melengkapi profil personal Anda.
                 </p>
                 <button 
                   onClick={() => navigate("/data-personal", { state: { fromHomeLock: true } })}
                   className="w-full bg-primary-50 text-white font-bold py-4 rounded-xl hover:bg-primary-60 shadow-lg shadow-primary-50/30 transition-all active:scale-95"
                 >
                   Lengkapi Profil Sekarang
                 </button>
               </div>
            </div>
          )}

          {/* ... Sisa form Data Medis ... */}
          <div className="bg-primary-10/40 border-b border-light-40 px-8 py-6 md:px-10 md:py-8 flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-bold text-dark-50 flex items-center gap-4">
              <div className="p-2.5 bg-gradient-to-br from-primary-40 to-primary-60 rounded-xl shadow-lg shadow-primary-20 flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              Data Medis Pasien
            </h2>
          </div>

          <div className="p-8 md:p-10 lg:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-14 gap-y-10">
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-8 h-[3px] bg-primary-40 rounded-full"></span><h3 className="text-primary-60 font-bold text-sm uppercase tracking-widest">Kondisi Kesehatan</h3>
                </div>
                <MultiSelectField label="Diagnosis Penyakit" options={diagnosisOptions} value={selectedDiagnoses} onChange={setSelectedDiagnoses} />
                <MultiSelectField label="Gejala Yang Dialami" options={symptomOptions} value={selectedSymptoms} onChange={setSelectedSymptoms} />
              </div>
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-8 h-[3px] bg-primary-40 rounded-full"></span><h3 className="text-primary-60 font-bold text-sm uppercase tracking-widest">Profil Keamanan</h3>
                </div>
                <MultiSelectField label="Kondisi Khusus" required options={specialConditionOptions} value={selectedCondition} onChange={handleConditionChange} />
                <SelectField label="Konsumsi Obat Kimia" required options={chemicalDrugOptions} value={selectedDrug} onChange={(c) => setSelectedDrug([c])} closeOnSelect={true} />
              </div>
            </div>

            {errorMessage && (
              <div className="mt-10 p-5 bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-2xl flex items-start gap-4 animate-[fadeIn_0.3s_ease-out] shadow-sm">
                <div className="p-2.5 bg-red-100 rounded-full text-danger-30 flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <div><h4 className="text-base font-bold text-red-800 mb-1">{errorMessage.type}</h4><p className="text-sm text-red-700 leading-relaxed font-medium">{errorMessage.text}</p></div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mt-14 pt-8 border-t border-light-40">
              <span className="text-dark-30 text-sm font-medium flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-30" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg> Data diproses secara rahasia & aman.
              </span>
              <div className="flex gap-4 w-full sm:w-auto">
                <button onClick={handleReset} disabled={isLoading || showProfileWarning} className="flex-1 sm:flex-none px-8 py-4 rounded-2xl font-bold text-dark-30 bg-light-20 hover:bg-red-50 hover:text-danger-30 transition-all disabled:opacity-50 disabled:cursor-not-allowed">Reset Data</button>
                <button onClick={handleSearch} disabled={isLoading || showProfileWarning} className={`flex-1 sm:flex-none text-white px-8 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 ${showProfileWarning ? "bg-gray-400 cursor-not-allowed" : "bg-gradient-to-r from-primary-40 to-primary-60 hover:from-primary-50 hover:to-primary-70 hover:shadow-xl hover:shadow-primary-30/50 active:scale-95"}`}>
                  {isLoading ? "Menganalisis..." : showProfileWarning ? "Terkunci" : "Cari Rekomendasi"}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div ref={resultRef} className="scroll-mt-10"><ResultSection recommendations={recommendations} selectedDrug={selectedDrug} /></div>
      </div>
    </MainLayout>
  );
}