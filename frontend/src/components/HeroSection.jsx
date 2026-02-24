/**
 * Komponen: HeroSection
 * Deskripsi: Menampilkan area header utama (Hero) di halaman beranda.
 * Berfungsi untuk menyambut pengguna dengan judul (headline) yang menarik 
 * dan menjelaskan secara singkat fungsi utama dari aplikasi (Sistem AI Herbal).
 */
export default function HeroSection() {
  return (
    <div className="text-center mb-12 max-w-3xl mx-auto">
      
      {/* ========================================== */}
      {/* 1. LENCANA (BADGE) STATUS AI                 */}
      {/* ========================================== */}
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-primary-20 shadow-sm text-primary-70 text-sm font-semibold mb-6 hover:shadow-md transition-all">
        
        {/* Indikator Titik Berkedip (Ping Animation) */}
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-40 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary-50"></span>
        </span>
        
        Sistem Cerdas Bertenaga AI
      </div>

      {/* ========================================== */}
      {/* 2. JUDUL UTAMA (HEADLINE)                    */}
      {/* ========================================== */}
      <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-dark-50 tracking-tight leading-[1.15] mb-6">
        Temukan Solusi Herbal <br className="hidden sm:block" /> 
        Secara <span className="text-primary-50 relative whitespace-nowrap">
          Aman & Akurat
          
          {/* Ornamen Garis Bawah Melengkung (Underline SVG) */}
          <svg className="absolute -bottom-3 left-0 w-full h-4 text-primary-20/70" viewBox="0 0 100 10" preserveAspectRatio="none">
            <path d="M0 5 Q 50 10 100 5" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
          </svg>
        </span>
      </h1>
      
      {/* ========================================== */}
      {/* 3. DESKRIPSI SINGKAT (SUB-HEADLINE)          */}
      {/* ========================================== */}
      <p className="text-lg md:text-xl text-dark-30 leading-relaxed px-4">
        Kami menganalisis gejala dan kondisi medis Anda untuk memberikan rekomendasi tanaman herbal yang telah tervalidasi secara komprehensif.
      </p>
      
    </div>
  );
}