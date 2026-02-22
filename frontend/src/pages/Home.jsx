import MainLayout from "../layouts/MainLayout";
import SelectField from "../components/SelectField";
import MultiSelectField from "../components/MultiSelectField";
import { useEffect, useState } from "react";

export default function Home() {
  const [diagnosisOptions, setDiagnosisOptions] = useState([]);
  const [symptomOptions, setSymptomOptions] = useState([]);

  const [selectedDiagnoses, setSelectedDiagnoses] = useState([]);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  
  const [selectedCondition, setSelectedCondition] = useState([]);
  const [selectedDrug, setSelectedDrug] = useState([]);

  const specialConditionOptions = [
    "Tidak ada",
    "Ibu hamil",
    "Ibu menyusui",
    "Anak di bawah lima tahun"
  ];

  const chemicalDrugOptions = ["Tidak", "Ya"];

  useEffect(() => {
    fetchDiagnoses();
    fetchSymptoms();
  }, []);

  const fetchDiagnoses = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/diagnoses");
      const data = await res.json();
      setDiagnosisOptions(data);
    } catch (err) {
      console.error("Error fetch diagnosis:", err);
    }
  };

  const fetchSymptoms = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/symptoms");
      const data = await res.json();
      setSymptomOptions(data);
    } catch (err) {
      console.error("Error fetch symptoms:", err)
    }
  };

  const handleConditionChange = (newArray) => {
  const exclusive = ["Tidak ada", "Anak di bawah lima tahun"];

  const lastClicked = newArray.find((item) => !selectedCondition.includes(item)) || selectedCondition.find((item) => !newArray.includes(item));

  if (!lastClicked) {
    setSelectedCondition(newArray);
    return;
  }

  const isExclusive = exclusive.includes(lastClicked);
  if (isExclusive) {
    setSelectedCondition([lastClicked]);
    return;
  }

  let cleaned = newArray.filter(
    (item) => !exclusive.includes(item)
  );

  setSelectedCondition(cleaned);
};

  const handleDrugToggle = (clickedItem) => {
    setSelectedDrug([clickedItem]);
  };

  const handleSearch = () => {
    console.log("Mencari Rekomendasi dengan:", {
      diagnosis: selectedDiagnoses,
      gejala: selectedSymptoms,
      kondisi: selectedCondition,
      obatKimia: selectedDrug
    });
  };

  // --- FUNGSI BARU: Untuk mereset semua form ---
  const handleReset = () => {
    setSelectedDiagnoses([]);
    setSelectedSymptoms([]);
    setSelectedCondition([]);
    setSelectedDrug([]);
  };

  return (
    <MainLayout>
      <div className="absolute top-0 inset-x-0 h-[550px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/60 via-blue-50/20 to-transparent -z-10" />

      <div className="max-w-5xl mx-auto pt-10 md:pt-14 px-4 pb-24">
        
        <div className="text-center mb-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-blue-100 shadow-sm text-blue-700 text-sm font-semibold mb-6">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
            </span>
            Sistem Cerdas Bertenaga AI
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight leading-[1.2] mb-6">
            Temukan Solusi Herbal <br className="hidden sm:block" /> 
            Secara <span className="text-blue-600 relative whitespace-nowrap">
              Aman & Akurat
              <svg className="absolute -bottom-2 left-0 w-full h-3 text-blue-200" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 50 10 100 5" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-600 leading-relaxed px-4">
            Kami menganalisis gejala dan kondisi medis Anda untuk memberikan rekomendasi tanaman herbal yang telah tervalidasi.
          </p>
        </div>

        <div className="bg-white rounded-[32px] shadow-[0_20px_50px_rgba(37,99,235,0.1)] border border-blue-50 overflow-hidden">
          
          <div className="bg-blue-600/5 border-b border-blue-50 px-8 py-6 md:px-10 md:py-8">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-4">
              <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-200 flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              Lengkapi Data Medis Pasien
            </h2>
          </div>

          <div className="p-8 md:p-10 lg:p-14">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-4">
              
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2 text-blue-700 font-bold text-sm uppercase tracking-widest">
                  <span className="w-6 h-[2px] bg-blue-600"></span>
                  Kondisi Kesehatan
                </div>
                <MultiSelectField label="Diagnosis Penyakit" options={diagnosisOptions} value={selectedDiagnoses} onChange={setSelectedDiagnoses} />
                <MultiSelectField label="Gejala Yang Dialami" options={symptomOptions} value={selectedSymptoms} onChange={setSelectedSymptoms} />
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2 text-blue-700 font-bold text-sm uppercase tracking-widest">
                  <span className="w-6 h-[2px] bg-blue-600"></span>
                  Profil Keamanan
                </div>
                <MultiSelectField label="Kondisi Khusus" required options={specialConditionOptions} value={selectedCondition} onChange={handleConditionChange} />
                <SelectField label="Konsumsi Obat Kimia" required options={chemicalDrugOptions} value={selectedDrug} onChange={handleDrugToggle} />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mt-12 md:mt-16 pt-8 md:pt-10 border-t border-gray-100">
              <span className="text-gray-400 text-sm italic text-center sm:text-left">
                * Data medis Anda diproses secara aman.
              </span>
              <div className="flex gap-4 w-full sm:w-auto">
                {/* --- TOMBOL RESET DENGAN ONCLICK --- */}
                <button 
                  onClick={handleReset}
                  className="flex-1 sm:flex-none px-8 py-3.5 rounded-2xl font-bold text-gray-500 hover:bg-gray-50 hover:text-red-500 transition-all"
                >
                  Reset
                </button>
                <button 
                  onClick={handleSearch} 
                  className="flex-1 sm:flex-none bg-blue-600 text-white px-8 py-3.5 rounded-2xl font-bold hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  Cari Rekomendasi
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}