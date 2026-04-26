/**
 * Komponen: HeroSection
 * Deskripsi: Menampilkan area header utama (Hero) di halaman beranda.
 * Berfungsi untuk menyambut pengguna dengan judul (headline) yang menarik 
 * dan menjelaskan secara singkat fungsi utama dari aplikasi (Sistem AI Herbal).
 */
export default function HeroSection() {
  return (
    <div className="text-center mb-12 max-w-3xl mx-auto">
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