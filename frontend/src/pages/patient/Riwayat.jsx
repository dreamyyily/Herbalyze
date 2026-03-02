import { useState, useEffect } from "react";
import MainLayout from "../../layouts/MainLayout";
import ResultSection from "../../components/ResultSection";

export default function Riwayat() {
  // ====================================================================
  // STATE MANAGEMENT
  // ====================================================================
  const [histories, setHistories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeHistory, setActiveHistory] = useState(null); // Mode detail resep

  // Filter & Search States
  const [searchTerm, setSearchTerm] = useState("");
  const [timeFilter, setTimeFilter] = useState("semua"); // "semua", "7hari", "30hari"

  // ====================================================================
  // DATA FETCHING (API CALL)
  // ====================================================================
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    const wallet = localStorage.getItem('user_wallet');
    
    if (!wallet) {
      setError("Autentikasi diperlukan. Silakan hubungkan dompet (wallet) Anda untuk melihat rekam medis.");
      setIsLoading(false);
      return;
    }

    try {
      // Mengambil data dari FastAPI backend
      const res = await fetch(`http://localhost:8000/api/history/${wallet}`);
      if (!res.ok) throw new Error("Gagal melakukan sinkronisasi dengan server database.");
      const data = await res.json();
      setHistories(data);
    } catch (err) {
      console.error("Fetch History Error:", err);
      setError("Koneksi terputus. Pastikan server backend Anda sedang berjalan.");
    } finally {
      setIsLoading(false);
    }
  };

  // ====================================================================
  // UTILITIES & HELPER FUNCTIONS
  // ====================================================================
  
  // Format waktu ISO (Backend) ke string kalender lokal (ID)
  const formatTanggal = (isoString) => {
    if (!isoString) return "Waktu tidak terdata";
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  // Engine Filter Cerdas (Kombinasi Teks & Rentang Waktu)
  const filteredHistories = histories.filter((hist) => {
    // 1. Text Search (Diagnosis & Gejala)
    const allInputs = [...(hist.diagnoses || []), ...(hist.symptoms || [])].join(" ").toLowerCase();
    const matchesSearch = allInputs.includes(searchTerm.toLowerCase());

    // 2. Time Range Filter
    let matchesTime = true;
    if (timeFilter !== "semua" && hist.created_at) {
      const histDate = new Date(hist.created_at);
      const today = new Date();
      const diffDays = Math.ceil(Math.abs(today - histDate) / (1000 * 60 * 60 * 24)); 

      if (timeFilter === "7hari") matchesTime = diffDays <= 7;
      if (timeFilter === "30hari") matchesTime = diffDays <= 30;
    }

    return matchesSearch && matchesTime;
  });

  // ====================================================================
  // RENDER VIEW 1: MODE DETAIL (Fokus pada satu resep)
  // ====================================================================
  if (activeHistory) {
    return (
      <MainLayout>
        {/* Background Ambient Glow */}
        <div className="absolute top-0 inset-x-0 h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-10/70 via-light-10 to-transparent -z-10 animate-[fadeIn_1s_ease-out]" />
        
        <div className="max-w-6xl mx-auto pt-10 md:pt-14 px-4 pb-24 animate-[slideUp_0.4s_ease-out]">
          {/* Back Button with Hover Effect */}
          <button 
            onClick={() => setActiveHistory(null)}
            className="group mb-8 inline-flex items-center gap-2.5 px-6 py-2.5 bg-white/80 backdrop-blur-md border border-light-40 rounded-full text-dark-40 hover:text-primary-50 hover:border-primary-30 hover:shadow-lg hover:shadow-primary-10/50 transition-all duration-300 font-bold text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:-translate-x-1.5 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Kembali ke Daftar Riwayat
          </button>

          {/* Rekap Header Info */}
          <div className="bg-gradient-to-br from-white to-primary-10/30 border border-primary-20/60 rounded-[32px] p-6 md:p-8 mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl shadow-primary-50/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-40/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
            
            <div className="relative z-10">
              <p className="text-primary-50 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary-40 animate-[pulse_2s_ease-in-out_infinite] shadow-[0_0_8px_rgba(37,99,235,0.6)]"></span>
                Dokumen Rekam Medis
              </p>
              <h3 className="text-2xl md:text-3xl font-extrabold text-dark-50 tracking-tight">{formatTanggal(activeHistory.created_at)}</h3>
            </div>
            
            <div className="flex flex-wrap gap-3 relative z-10">
              {activeHistory.special_conditions?.length > 0 && activeHistory.special_conditions[0] !== "Tidak ada" && (
                <span className="px-4 py-2 bg-gradient-to-r from-amber-50 to-amber-100/50 text-amber-700 border border-amber-200/60 rounded-full text-sm font-bold shadow-sm flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  {activeHistory.special_conditions.join(', ')}
                </span>
              )}
              {activeHistory.chemical_drugs?.includes("Ya") && (
                <span className="px-4 py-2 bg-gradient-to-r from-danger-30/10 to-danger-30/5 text-danger-30 border border-danger-30/20 rounded-full text-sm font-bold shadow-sm flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 2a1 1 0 00-.707 1.707L7 4.414v3.758a1 1 0 01-.293.707l-4 4C.817 14.769 2.156 18 4.828 18h10.343c2.673 0 4.012-3.231 2.122-5.121l-4-4A1 1 0 0113 8.172V4.414l.707-.707A1 1 0 0013 2H7zm2 6.172V4h2v4.172a3 3 0 00.879 2.12l1.027 1.028a4 4 0 00-2.171.102l-.47.156a4 4 0 01-2.53 0l-.563-.187a1.993 1.993 0 00-.114-.035l1.063-1.063A3 3 0 009 8.172z" clipRule="evenodd" /></svg>
                  Mengonsumsi Obat Kimia
                </span>
              )}
            </div>
          </div>

          {/* Injeksi Komponen AI Result */}
          <ResultSection recommendations={activeHistory.recommendations} selectedDrug={activeHistory.chemical_drugs} />
        </div>
      </MainLayout>
    );
  }

  // ====================================================================
  // RENDER VIEW 2: MODE MASTER LIST (Daftar Riwayat dengan Timeline)
  // ====================================================================
  return (
    <MainLayout>
      <div className="absolute top-0 inset-x-0 h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-10/80 via-light-10 to-transparent -z-10" />

      <div className="max-w-4xl mx-auto pt-10 md:pt-14 px-4 pb-28 min-h-[75vh]">
        
        {/* --- PAGE HEADER --- */}
        <div className="text-center mb-10 animate-[fadeIn_0.5s_ease-out]">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[28px] bg-white text-primary-50 mb-6 shadow-[0_15px_40px_rgba(37,99,235,0.15)] border border-primary-10/50 -rotate-3 hover:rotate-0 transition-transform duration-500 ease-out">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-dark-50 mb-4 tracking-tight leading-tight">
            Riwayat <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-60 to-primary-40">Kesehatan</span>
          </h1>
          <p className="text-dark-30 text-lg md:text-xl max-w-2xl mx-auto font-medium">Rekam jejak pintar analisis kondisi medis dan kumpulan resep herbal Anda.</p>
        </div>

        {/* --- GLASSMORPHISM CONTROL PANEL (SEARCH & FILTER) --- */}
        {!isLoading && !error && histories.length > 0 && (
          <div className="sticky top-24 z-30 bg-white/70 backdrop-blur-xl rounded-[28px] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-white/50 mb-12 flex flex-col md:flex-row gap-4 justify-between items-center animate-[slideDown_0.6s_ease-out_forwards]">
            
            {/* Input Search Modern */}
            <div className="relative w-full md:w-auto flex-1 max-w-md group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-dark-20 group-focus-within:text-primary-50 transition-colors">
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Cari nama penyakit atau gejala..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-11 pr-4 py-3.5 border border-light-40 rounded-2xl bg-light-10/50 placeholder-dark-20 text-dark-50 font-medium focus:outline-none focus:bg-white focus:ring-4 focus:ring-primary-10 focus:border-primary-40 transition-all duration-300 shadow-inner inset-y-1"
              />
            </div>

            {/* iOS-Style Segmented Control Filter */}
            <div className="flex bg-light-20/60 p-1.5 rounded-2xl w-full md:w-auto overflow-x-auto border border-light-40 shrink-0">
              {[
                { id: "semua", label: "Semua Waktu" },
                { id: "7hari", label: "7 Hari Terakhir" },
                { id: "30hari", label: "30 Hari Terakhir" }
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setTimeFilter(btn.id)}
                  className={`relative px-5 py-2.5 text-sm font-extrabold rounded-xl transition-all duration-300 whitespace-nowrap ${
                    timeFilter === btn.id 
                      ? "bg-white text-primary-50 shadow-[0_4px_12px_rgba(0,0,0,0.06)] scale-100" 
                      : "text-dark-30 hover:text-dark-50 hover:bg-light-10/50 scale-95"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* --- STATE: LOADING --- */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-32 animate-pulse">
            <div className="relative w-16 h-16 mb-6">
              <div className="absolute inset-0 border-4 border-primary-10 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-primary-50 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <p className="text-dark-30 font-bold tracking-wide">Membuka brankas medis digital...</p>
          </div>
        )}

        {/* --- STATE: ERROR --- */}
        {!isLoading && error && (
          <div className="bg-gradient-to-b from-white to-danger-30/5 border border-danger-30/20 rounded-[40px] p-12 text-center max-w-2xl mx-auto shadow-2xl shadow-danger-30/10 animate-[slideUp_0.5s_ease-out]">
            <div className="w-24 h-24 bg-danger-30/10 rounded-full flex items-center justify-center mx-auto mb-6 text-danger-30">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h3 className="text-3xl font-extrabold text-dark-50 mb-4 tracking-tight">Koneksi Terputus</h3>
            <p className="text-dark-40 text-lg font-medium leading-relaxed max-w-md mx-auto">{error}</p>
          </div>
        )}

        {/* --- STATE: EMPTY (Belum pernah mencari sama sekali) --- */}
        {!isLoading && !error && histories.length === 0 && (
          <div className="bg-white/60 backdrop-blur-sm border-2 border-dashed border-light-40 hover:border-primary-30 transition-colors duration-500 rounded-[40px] p-16 text-center max-w-2xl mx-auto shadow-sm animate-[fadeIn_0.8s_ease-out]">
            <div className="w-28 h-28 bg-gradient-to-tr from-light-20 to-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-dark-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <h3 className="text-3xl font-extrabold text-dark-50 mb-4 tracking-tight">Belum Ada Catatan</h3>
            <p className="text-dark-30 text-lg mb-10 font-medium max-w-md mx-auto">Riwayat Anda masih kosong. Mari mulai dengan menemukan solusi herbal cerdas untuk keluhan Anda hari ini.</p>
            <a href="/home" className="inline-flex items-center gap-3 px-8 py-4 bg-primary-50 hover:bg-primary-60 text-white rounded-full font-bold transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_15px_30px_rgba(37,99,235,0.3)]">
              Mulai Analisis Baru
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </a>
          </div>
        )}

        {/* --- STATE: NOT FOUND (Filter tidak cocok) --- */}
        {!isLoading && !error && histories.length > 0 && filteredHistories.length === 0 && (
          <div className="text-center py-20 bg-white/50 backdrop-blur-sm rounded-[32px] border border-light-40 animate-[fadeIn_0.4s_ease-out]">
            <span className="text-6xl mb-4 block">🔍</span>
            <h4 className="text-xl font-bold text-dark-40 mb-2">Pencarian Tidak Ditemukan</h4>
            <p className="text-dark-30 font-medium mb-6">Tidak ada riwayat yang cocok dengan kata kunci atau filter waktu Anda.</p>
            <button onClick={() => {setSearchTerm(""); setTimeFilter("semua");}} className="px-6 py-2.5 bg-light-20 hover:bg-light-40 text-dark-50 rounded-full font-bold transition-colors">
              Reset Semua Filter
            </button>
          </div>
        )}

        {/* --- DATA TERSEDIA: TIMELINE CARDS WATERFALL ANIMATION --- */}
        {!isLoading && !error && filteredHistories.length > 0 && (
          <div className="space-y-6 relative before:absolute before:inset-y-6 before:left-[27px] before:w-1 before:bg-gradient-to-b before:from-primary-40/60 before:via-light-40 before:to-transparent hidden sm:block sm:before:block">
            {filteredHistories.map((hist, index) => {
              const totalHerbs = hist.recommendations?.reduce((sum, group) => sum + group.herbs.length, 0) || 0;
              const allInputs = [...(hist.diagnoses || []), ...(hist.symptoms || [])];

              return (
                <div 
                  key={hist.id} 
                  className="relative sm:pl-[72px] animate-[staggeredFadeIn_0.6s_ease-out_forwards]" 
                  style={{ opacity: 0, animationDelay: `${index * 120}ms` }} // Efek air terjun berdasar index
                >
                  {/* Titik Timeline Bercahaya (Radar Ping) */}
                  <div className="hidden sm:block absolute left-5 top-8 z-10">
                    <div className="absolute inset-0 w-4 h-4 bg-primary-40 rounded-full animate-ping opacity-75"></div>
                    <div className="relative w-4 h-4 bg-primary-50 rounded-full border-[3px] border-white shadow-[0_0_12px_rgba(37,99,235,0.6)]"></div>
                  </div>

                  {/* KARTU KLIKABLE (Interactive Card) */}
                  <div 
                    onClick={() => setActiveHistory(hist)}
                    className="group cursor-pointer bg-white rounded-[32px] border border-light-40 p-6 md:p-8 shadow-sm hover:shadow-[0_20px_40px_rgba(37,99,235,0.12)] hover:-translate-y-1.5 hover:border-primary-30/80 transition-all duration-500 relative overflow-hidden"
                  >
                    {/* Efek Latar Mengkilap Halus saat di-hover */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary-10/0 via-transparent to-primary-10/40 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>

                    <div className="relative z-10">
                      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6 mb-8">
                        
                        {/* Kiri: Waktu & Penyakit  */}
                        <div className="flex-1 pr-4">
                          <p className="text-xs font-bold text-primary-50 uppercase tracking-[0.15em] mb-2 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            {formatTanggal(hist.created_at)}
                          </p>
                          <h3 className="text-lg md:text-xl font-extrabold text-dark-50 leading-snug group-hover:text-primary-60 transition-colors duration-300">
                            {allInputs.length > 0 ? allInputs.join(", ") : "Analisis Umum"}
                          </h3>
                        </div>
                        
                        {/* Kanan: Badges Dinamis */}
                        <div className="flex flex-wrap items-center gap-2.5 xl:justify-end shrink-0">
                          {hist.special_conditions?.length > 0 && hist.special_conditions[0] !== "Tidak ada" && (
                            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200/80 text-amber-700 text-xs font-bold shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              {hist.special_conditions.join(', ')}
                            </span>
                          )}
                          {hist.chemical_drugs?.includes("Ya") && (
                            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-danger-30/10 border border-danger-30/20 text-danger-30 text-xs font-bold shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-danger-30"></span>
                              Obat Kimia
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-light-10 text-dark-40 rounded-full text-xs font-extrabold border border-light-40 group-hover:bg-primary-10 group-hover:border-primary-20 group-hover:text-primary-60 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 2a1 1 0 00-.707 1.707L7 4.414v3.758a1 1 0 01-.293.707l-4 4C.817 14.769 2.156 18 4.828 18h10.343c2.673 0 4.012-3.231 2.122-5.121l-4-4A1 1 0 0113 8.172V4.414l.707-.707A1 1 0 0013 2H7zm2 6.172V4h2v4.172a3 3 0 00.879 2.12l1.027 1.028a4 4 0 00-2.171.102l-.47.156a4 4 0 01-2.53 0l-.563-.187a1.993 1.993 0 00-.114-.035l1.063-1.063A3 3 0 009 8.172z" clipRule="evenodd" /></svg>
                            {totalHerbs} Herbal Ditemukan
                          </span>
                        </div>
                      </div>

                      {/* Batas Bawah & Action CTA */}
                      <div className="flex items-center justify-end pt-5 border-t border-light-40/60 mt-2">
                        <span className="inline-flex items-center justify-center gap-2.5 px-7 py-3 rounded-full bg-light-10 group-hover:bg-primary-50 text-dark-40 group-hover:text-white text-sm font-extrabold transition-all duration-500">
                          Buka Rekam Medis
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:translate-x-1.5 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ====================================================================
          CUSTOM KEYFRAMES UNTUK ANIMASI PREMIUM
          Disisipkan langsung agar tidak perlu merusak tailwind.config.js
      ==================================================================== */}
      <style>{`
        @keyframes fadeIn { 
          from { opacity: 0; } 
          to { opacity: 1; } 
        }
        @keyframes slideUp { 
          from { opacity: 0; transform: translateY(30px); } 
          to { opacity: 1; transform: translateY(0); } 
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes staggeredFadeIn {
          from { opacity: 0; transform: translateY(40px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </MainLayout>
  );
}