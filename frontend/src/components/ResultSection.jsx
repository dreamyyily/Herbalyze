import { useState, useEffect } from "react";

/**
 * Komponen: ResultSection
 * Deskripsi: Menampilkan hasil rekomendasi AI dalam bentuk Laci (Accordion) dan Kartu.
 * Dilengkapi dengan Modal Detail untuk menampilkan informasi lengkap tanaman herbal.
 */
export default function ResultSection({ recommendations, selectedDrug }) {
  // ========================================================================
  // 1. STATE & PENGATURAN AWAL
  // ========================================================================
  
  // State untuk menampung data tanaman herbal yang diklik (untuk membuka Modal)
  const [selectedItem, setSelectedItem] = useState(null);
  
  // State untuk mengontrol laci (accordion) mana yang sedang terbuka. 
  // Default 0 berarti laci urutan pertama akan otomatis terbuka.
  const [openAccordion, setOpenAccordion] = useState(0);

  // Efek: Setiap kali data rekomendasi berubah (user melakukan pencarian baru),
  // reset laci agar yang terbuka kembali ke laci urutan pertama (index 0).
  useEffect(() => {
    setOpenAccordion(0);
  }, [recommendations]);

  // ========================================================================
  // 2. FUNGSI BANTUAN (HELPERS) & PENANGANAN ERROR
  // ========================================================================

  // Jika belum ada pencarian, jangan tampilkan apa-apa (sembunyikan komponen)
  if (recommendations === null) return null;

  // Penanganan Error: Jika server gagal merespons dengan format Array yang benar
  if (!Array.isArray(recommendations)) {
    return (
      <div className="mt-20 max-w-3xl mx-auto text-center animate-[fadeIn_0.5s_ease-out]">
        <div className="bg-danger-30/10 border border-danger-30/20 text-danger-30 p-8 rounded-[28px] shadow-sm">
          <h3 className="text-xl font-bold mb-2">Terjadi Kesalahan di Server</h3>
          <p className="opacity-80 mb-4">Aplikasi gagal memproses rekomendasi. Pastikan server backend menyala.</p>
        </div>
      </div>
    );
  }

  // Fungsi untuk menutup popup modal
  const closeModal = () => setSelectedItem(null);

  // Fungsi untuk merapikan nama herbal yang mungkin berantakan dari database
  const getCleanName = (rawName) => {
    return rawName 
      ? rawName.split(/[\r\n]+/).map(n => n.trim()).filter(n => n !== "").join(', ') 
      : "Nama Herbal Tidak Diketahui";
  };

  // Menghitung total seluruh tanaman herbal dari semua kelompok diagnosis/gejala
  const totalHerbs = recommendations.reduce((sum, group) => sum + group.herbs.length, 0);

  // ========================================================================
  // 3. RENDER ANTARMUKA UTAMA (DAFTAR LACI & KARTU)
  // ========================================================================
  return (
    <div className="mt-16 sm:mt-20 animate-[fadeIn_0.5s_ease-out]">
      
      {/* --- HEADER HASIL PENCARIAN --- */}
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-extrabold text-dark-50 mb-4">
          Hasil Analisis AI <span className="text-primary-40">Herbalyze</span>
        </h2>
        {totalHerbs > 0 ? (
          <p className="text-lg text-dark-30 max-w-2xl mx-auto">
            Kami telah menyusun <span className="font-bold text-primary-50 bg-primary-10 px-3 py-1 rounded-full mx-1">{totalHerbs}</span> rekomendasi herbal ke dalam kelompok di bawah ini. Silakan klik untuk melihat detailnya.
          </p>
        ) : (
          <p className="text-lg text-amber-600 bg-amber-50 p-4 rounded-xl inline-block border border-amber-100">
            Mohon maaf, kami tidak menemukan herbal yang aman/cocok untuk kondisi Anda.
          </p>
        )}
      </div>

      {/* --- DAFTAR ACCORDION (LACI) --- */}
      {totalHerbs > 0 && (
        <div className="max-w-5xl mx-auto space-y-4">
          {recommendations.map((group, index) => {
            const isOpen = openAccordion === index;
            const isDiagnosis = group.group_type.toLowerCase() === 'diagnosis';

            return (
              <div 
                key={index} 
                className={`bg-light-10 rounded-[24px] sm:rounded-[32px] overflow-hidden transition-all duration-300 ${
                  isOpen ? 'ring-2 ring-primary-40/20 shadow-xl shadow-primary-50/5' : 'border border-light-40 shadow-sm hover:border-primary-30'
                }`}
              >
                {/* 3.1. TOMBOL HEADER LACI */}
                <button
                  onClick={() => setOpenAccordion(isOpen ? null : index)}
                  className={`w-full flex items-center justify-between p-5 sm:p-6 transition-colors duration-300 ${
                    isOpen ? 'bg-primary-10/40' : 'bg-light-10 hover:bg-light-20/80'
                  }`}
                >
                  <div className="flex items-center gap-4 sm:gap-6 text-left">
                    {/* Ikon Semantik: Indigo untuk Diagnosis, Oranye untuk Gejala */}
                    <div className={`flex items-center justify-center flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl shadow-sm ${
                      isDiagnosis ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-600'
                    }`}>
                      {isDiagnosis ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-7 sm:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-7 sm:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                      )}
                    </div>
                    
                    <div>
                      <h4 className={`text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1 ${
                        isDiagnosis ? 'text-indigo-500' : 'text-orange-500'
                      }`}>
                        {group.group_type}
                      </h4>
                      <h3 className="text-xl sm:text-2xl font-extrabold text-dark-50 leading-tight">
                        {group.group_name}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-5">
                    {/* Badge Jumlah Tanaman */}
                    <span className="hidden sm:flex items-center justify-center px-4 py-1.5 bg-light-10 border border-light-40 rounded-full text-sm font-bold text-dark-30 shadow-sm">
                      {group.herbs.length} Tanaman
                    </span>
                    {/* Indikator Panah (Berputar saat terbuka) */}
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border transition-all duration-300 ${
                      isOpen ? 'bg-primary-40 border-primary-40 text-light-10 rotate-180 shadow-md' : 'bg-light-10 border-light-40 text-dark-20'
                    }`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </div>
                  </div>
                </button>

                {/* 3.2. ISI LACI (GRID KARTU HERBAL) */}
                {isOpen && (
                  <div className="animate-[slideDown_0.3s_ease-out] border-t border-light-40 bg-light-20/50 p-5 sm:p-8">
                    
                    {/* Logika Tata Letak Grid: Auto-center jika jumlah kartu sedikit */}
                    <div className={`grid gap-6 lg:gap-8 transition-all duration-500 ${
                      group.herbs.length === 1 
                        ? 'grid-cols-1 max-w-[360px] mx-auto' 
                        : group.herbs.length === 2 
                          ? 'grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto' 
                          : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                    }`}>
                      
                      {/* Pembuatan Kartu Individual */}
                      {group.herbs.map((item, herbIndex) => {
                        const fullCleanName = getCleanName(item.name);
                        const nameParts = fullCleanName.split(',').map(n => n.trim()).filter(Boolean);
                        const primaryName = nameParts[0];
                        const compactParts = item.part ? item.part.split(/[\r\n]+/).map(p => p.trim()).filter(Boolean).join(', ') : "Tidak Terdata";

                        return (
                          <div 
                            key={herbIndex} 
                            className="group bg-light-10 rounded-[24px] overflow-hidden border border-light-40 shadow-sm hover:shadow-[0_20px_40px_rgba(37,99,235,0.08)] hover:-translate-y-1 transition-all duration-300 flex flex-col"
                          >
                            {/* Area Gambar Kartu */}
                            <div className="h-48 relative bg-gradient-to-tr from-primary-10 to-light-20 overflow-hidden">
                              {item.image ? (
                                <img src={item.image} alt={primaryName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" onError={(e) => { e.target.style.display = 'none'; }} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-dark-20">No Image</div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-dark-50/60 to-transparent"></div>
                              <div className="absolute bottom-3 left-4 right-4">
                                <span className="inline-block px-2.5 py-1 bg-light-10/90 backdrop-blur-sm text-primary-50 text-[10px] font-bold uppercase tracking-widest rounded-md">
                                  {item.latin || "Spesies Herbal"}
                                </span>
                              </div>
                            </div>

                            {/* Area Teks Kartu */}
                            <div className="p-5 md:p-6 flex-1 flex flex-col bg-light-10">
                              <h3 className="text-xl font-bold text-dark-50 mb-2 line-clamp-1 leading-snug" title={fullCleanName}>
                                {primaryName}
                              </h3>
                              {/* Warna Emerald dipertahankan untuk semantik bagian tanaman */}
                              <p className="text-emerald-600 text-xs font-bold uppercase tracking-wider mb-2">
                                Bagian: {compactParts}
                              </p>
                              <p className="text-dark-30 text-sm line-clamp-2 mb-5 flex-1">
                                {item.preparation || "Klik untuk melihat detail penyiapan..."}
                              </p>
                              
                              <button 
                                onClick={() => setSelectedItem(item)}
                                className="w-full py-3 px-4 bg-primary-10 text-primary-50 font-bold rounded-xl hover:bg-primary-40 hover:text-light-10 transition-all duration-300 flex items-center justify-center gap-2 active:scale-95"
                              >
                                Baca Selengkapnya
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================
          4. MODAL POPUP DETAIL LENGKAP
          Muncul menutupi layar (Overlay) ketika sebuah kartu di-klik
      ======================================================================== */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-dark-50/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          {/* Latar Belakang Klik-Sembunyi */}
          <div className="absolute inset-0" onClick={closeModal}></div>

          {/* Kontainer Utama Modal */}
          <div className="relative bg-light-10 rounded-[32px] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-[slideUp_0.3s_ease-out]">
            
            {/* Tombol Silang (Tutup) */}
            <button 
              onClick={closeModal}
              className="absolute top-4 right-4 z-10 p-2 bg-light-10/50 hover:bg-light-10 backdrop-blur-md rounded-full text-dark-30 hover:text-danger-30 transition-colors shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            {/* Area Konten yang Bisa Digulir (Scrollable Area) */}
            <div className="overflow-y-auto">
              
              {/* IIFE (Immediately Invoked Function Expression) 
                  Digunakan untuk mengolah data kotor sebelum dirender di Modal */}
              {(() => {
                const fullCleanName = getCleanName(selectedItem.name);
                const nameParts = fullCleanName.split(',').map(n => n.trim()).filter(Boolean);
                const primaryName = nameParts[0];
                const aliasNames = nameParts.slice(1).join(', ');

                // Deteksi khusus untuk format data dari sumber "Socfindo"
                const isSocfindo = (selectedItem.source_link && selectedItem.source_link.toLowerCase().includes('socfindo')) ||
                                   (selectedItem.source_label && selectedItem.source_label.toLowerCase().includes('socfindo'));

                return (
                  <>
                    {/* 4.1. HEADER GAMBAR BESAR */}
                    <div className="h-64 sm:h-72 relative bg-light-30 w-full">
                       {selectedItem.image && (
                         <img src={selectedItem.image} alt={primaryName} className="w-full h-full object-cover" />
                       )}
                       <div className="absolute inset-0 bg-gradient-to-t from-dark-50/90 via-dark-50/30 to-transparent"></div>
                       <div className="absolute bottom-6 left-6 right-8">
                          <span className="inline-block px-3 py-1 mb-3 bg-primary-40 text-light-10 text-xs font-bold uppercase tracking-widest rounded-lg shadow-sm">
                            {selectedItem.latin || "Spesies Herbal"}
                          </span>
                          <h2 className="text-3xl sm:text-4xl font-extrabold text-light-10 leading-tight drop-shadow-md">
                            {primaryName}
                          </h2>
                       </div>
                    </div>

                    {/* 4.2. ISI DETAIL MODAL */}
                    <div className="p-6 sm:p-8 space-y-8">
                      
                      {/* Peringatan Interaksi Obat (Hanya muncul jika user minum obat kimia) */}
                      {selectedDrug && selectedDrug.includes("Ya") && (
                        <div className="bg-danger-30/10 border-l-4 border-danger-30 p-4 sm:p-5 rounded-r-2xl shadow-sm animate-[fadeIn_0.5s_ease-out]">
                          <div className="flex items-start gap-3 sm:gap-4">
                            <div className="p-2 bg-light-10 rounded-full text-danger-30 flex-shrink-0 mt-0.5">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            </div>
                            <div>
                              <h4 className="text-sm sm:text-base font-bold text-danger-30 mb-1">Instruksi Keamanan Medis!</h4>
                              <p className="text-xs sm:text-sm text-danger-30/90 leading-relaxed">
                                Karena Anda sedang mengonsumsi obat medis/kimia, Anda <strong>WAJIB memberikan jeda waktu minimal 2 jam</strong> sebelum atau sesudah meminum ramuan herbal ini untuk mencegah interaksi obat yang membahayakan fungsi hati.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Nama Alias/Sinonim */}
                      {aliasNames && (
                        <div className="bg-light-20 border border-light-40 rounded-2xl p-4 sm:p-5">
                          <h4 className="text-xs font-bold text-dark-30 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
                            Nama Daerah / Sinonim
                          </h4>
                          <p className="text-dark-40 text-sm leading-relaxed font-medium">
                            {aliasNames}
                          </p>
                        </div>
                      )}

                      {/* BLOK PERACIKAN HERBAL (Multi-bagian & Gambar) */}
                      <div>
                        <h4 className="text-sm font-bold text-dark-30 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.696 2.332a.75.75 0 01.304.757v4.161l.534.223a6 6 0 013.43 5.093v.016a.75.75 0 01-1.498.058v-.016a4.5 4.5 0 00-2.572-3.82l-.894-.373v4.069a.75.75 0 01-1.5 0V8.361l-.894.373a4.5 4.5 0 00-2.572 3.82v.016a.75.75 0 01-1.498-.058v-.016a6 6 0 013.43-5.093l.534-.223V3.089a.75.75 0 01.304-.757l3.8-1.52a.75.75 0 01.892.203z" clipRule="evenodd" /></svg>
                          Varian Bagian & Cara Penyiapan
                        </h4>

                        {/* Rendering Dinamis Bagian-Bagian Tanaman */}
                        {(() => {
                          const partsArray = selectedItem.part ? selectedItem.part.split(/[\r\n]+/).map(p => p.trim()).filter(Boolean) : ["Tidak Terdata"];
                          const prepsArray = partsArray.length > 1 && selectedItem.preparation ? selectedItem.preparation.split(/[\r\n]+/).map(p => p.trim()).filter(Boolean) : [selectedItem.preparation || "Informasi penyiapan belum tersedia di database."];
                          const imagesArray = partsArray.length > 1 && selectedItem.part_image ? selectedItem.part_image.split(/[\r\n]+/).map(p => p.trim()).filter(Boolean) : [selectedItem.part_image];
                          const isMultiPart = partsArray.length > 1;

                          return (
                            <div className="flex flex-col gap-5">
                              {partsArray.map((partName, idx) => {
                                const prepText = prepsArray[idx] || prepsArray[0]; 
                                const partImgUrl = imagesArray[idx] || imagesArray[0];

                                let renderPreparation;
                                
                                // Format List Numerik khusus untuk format data Socfindo
                                if (isSocfindo) {
                                  const steps = prepText.includes('\n') ? prepText.split(/[\r\n]+/) : prepText.split(/\.\s+/);
                                  const cleanSteps = steps.map(s => s.trim()).filter(Boolean);
                                  
                                  if (cleanSteps.length > 1) {
                                    renderPreparation = (
                                      <div className="bg-light-10/50 p-4 rounded-xl">
                                        <ol className="list-decimal list-outside ml-5 space-y-2.5 text-dark-40 text-sm sm:text-[15px] leading-relaxed marker:text-primary-40 marker:font-bold">
                                          {cleanSteps.map((step, i) => (
                                            <li key={i} className="pl-1.5">{step.endsWith('.') ? step : step + '.'}</li>
                                          ))}
                                        </ol>
                                      </div>
                                    );
                                  } else if (cleanSteps.length === 1) {
                                    renderPreparation = (
                                      <div className="bg-light-10/80 p-4 rounded-xl border border-light-40/50 shadow-sm hover:bg-light-10 transition-colors">
                                        <p className="text-dark-40 text-sm sm:text-[15px] leading-relaxed text-justify">
                                          {cleanSteps[0].endsWith('.') ? cleanSteps[0] : cleanSteps[0] + '.'}
                                        </p>
                                      </div>
                                    );
                                  }
                                } 
                                // Format Paragraf ber-Badge untuk sumber non-Socfindo
                                else {
                                  const paragraphs = prepText.split(/(?:\r?\n){2,}/).map(p => p.trim()).filter(Boolean);
                                  
                                  renderPreparation = (
                                    <div className="space-y-3">
                                      {paragraphs.map((para, pIdx) => {
                                        let badge = null;
                                        let content = para;
                                        const colonIndex = para.indexOf(':');

                                        // Deteksi kata sebelum titik dua (:) sebagai Badge Metode
                                        if (colonIndex > 0 && colonIndex <= 25) {
                                          badge = para.substring(0, colonIndex).trim();
                                          content = para.substring(colonIndex + 1).trim(); 
                                        }

                                        return (
                                          <div key={pIdx} className="bg-light-10/80 p-4 rounded-xl border border-light-40/50 shadow-sm hover:bg-light-10 transition-colors">
                                            {badge && (
                                              <span className="inline-flex mb-2.5 px-3 py-1 bg-primary-10 text-primary-60 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest rounded-md">
                                                Metode: {badge}
                                              </span>
                                            )}
                                            <p className="text-dark-40 text-sm sm:text-[15px] leading-relaxed text-justify">
                                              {content.replace(/[\r\n]+/g, ' ')}
                                            </p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                }

                                return (
                                  <div key={idx} className={`${isMultiPart ? 'bg-primary-10/30 border-primary-20' : 'bg-light-20/60 border-light-40'} border rounded-2xl p-5 sm:p-6 hover:shadow-sm transition-all`}>
                                    <h5 className="font-bold text-lg text-dark-50 mb-4 flex items-center gap-2">
                                      {isMultiPart && (
                                        <span className="bg-emerald-100 text-emerald-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">{idx + 1}</span>
                                      )}
                                      {isMultiPart ? `Bagian ${partName}` : `Bagian: ${partName}`}
                                    </h5>
                                    
                                    {/* Gambar Khusus untuk Bagian Tanaman tersebut */}
                                    {partImgUrl && partImgUrl !== "-" && (
                                      <div className="w-full h-40 sm:h-48 rounded-xl mb-6 overflow-hidden bg-light-10 border border-light-40 shadow-sm flex items-center justify-center p-2">
                                        <img 
                                          src={partImgUrl} 
                                          alt={`Bagian ${partName}`} 
                                          className="max-w-full max-h-full object-contain hover:scale-105 transition-transform duration-500" 
                                          onError={(e) => { e.target.style.display = 'none'; }} 
                                        />
                                      </div>
                                    )}
                                    {renderPreparation}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>

                      {/* 4.3. SUMBER REFERENSI MEDIS */}
                      <div className="pt-6 border-t border-dashed border-light-40">
                        <h4 className="text-xs font-bold text-dark-30 uppercase tracking-widest mb-4">Sumber Kajian & Referensi Medis</h4>
                        <div className="flex flex-col gap-3">
                          {(() => {
                            const sourceLinks = selectedItem.source_link ? selectedItem.source_link.split(/[\r\n]+/).map(s => s.trim()).filter(s => s && s !== "-") : [];
                            const sourceLabels = selectedItem.source_label ? selectedItem.source_label.split(/[\r\n]+/).map(s => s.trim()).filter(s => s && s !== "-") : [];
                            
                            if (sourceLinks.length === 0 && sourceLabels.length === 0) {
                              return <span className="text-sm text-dark-30 italic">Tidak ada referensi tertaut.</span>;
                            }

                            // Jika berbentuk Link (bisa di-klik)
                            return sourceLinks.length > 0 ? sourceLinks.map((link, idx) => (
                              <a key={idx} href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-3 p-3 rounded-xl bg-light-20 hover:bg-primary-10 text-sm text-primary-40 hover:text-primary-60 transition-colors border border-transparent hover:border-primary-20">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                <span className="line-clamp-2 leading-snug break-all font-medium">{sourceLabels[idx] || link}</span>
                              </a>
                            )) : 
                            // Jika berbentuk Label Teks Biasa (Buku/Jurnal Offline)
                            sourceLabels.map((label, idx) => (
                              <div key={idx} className="inline-flex items-start gap-3 p-3 rounded-xl bg-light-20 text-sm text-dark-40 border border-light-40">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 text-dark-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                <span className="leading-snug">{label}</span>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>

                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Definisi Animasi Halus untuk Transisi Laci dan Modal */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(50px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}