export default function HeroSection() {
  return (
    <div className="text-center mb-12 max-w-3xl mx-auto">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-blue-100 shadow-sm text-blue-700 text-sm font-semibold mb-6 hover:shadow-md transition-all">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
        </span>
        Sistem Cerdas Bertenaga AI
      </div>

      <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight leading-[1.15] mb-6">
        Temukan Solusi Herbal <br className="hidden sm:block" /> 
        Secara <span className="text-blue-600 relative whitespace-nowrap">
          Aman & Akurat
          <svg className="absolute -bottom-3 left-0 w-full h-4 text-blue-200/70" viewBox="0 0 100 10" preserveAspectRatio="none">
            <path d="M0 5 Q 50 10 100 5" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
          </svg>
        </span>
      </h1>
      
      <p className="text-lg md:text-xl text-gray-600 leading-relaxed px-4">
        Kami menganalisis gejala dan kondisi medis Anda untuk memberikan rekomendasi tanaman herbal yang telah tervalidasi secara komprehensif.
      </p>
    </div>
  );
}