import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import MainLayout from "../../layouts/MainLayout";
import SelectField from "../../components/SelectField";
import MultiSelectField from "../../components/MultiSelectField";
import ResultSection from "../../components/ResultSection";
import { FileText, AlertTriangle, Loader2, Sparkles } from "lucide-react";

export default function AiSearch() {
  const location = useLocation();
  const navigate = useNavigate();
  const resultRef = useRef(null);

  // State untuk form SBERT
  const [promptText, setPromptText] = useState("");
  const [selectedCondition, setSelectedCondition] = useState([]);
  const [selectedDrug, setSelectedDrug] = useState([]);

  // State UI & Data
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const specialConditionOptions = ["Tidak ada", "Ibu hamil", "Ibu menyusui"];
  const chemicalDrugOptions = ["Tidak", "Ya"];

  const [isFromDoctor, setIsFromDoctor] = useState(false);

  useEffect(() => {
    if (location.state && location.state.useSbertMode) {
      setPromptText(location.state.sbertQuery || "");
      setIsFromDoctor(true);
      if (location.state.kondisiKhusus) {
        setSelectedCondition([location.state.kondisiKhusus]);
      } else {
        setSelectedCondition(["Tidak ada"]);
      }
    }
  }, [location]);

  const handleConditionChange = (newArray) => {
    const lastClicked = newArray.find((item) => !selectedCondition.includes(item)) 
      || selectedCondition.find((item) => !newArray.includes(item));

    if (!lastClicked) { setSelectedCondition(newArray); return; }

    if (lastClicked === "Tidak ada") {
      setSelectedCondition(["Tidak ada"]);
      return;
    }

    const cleaned = newArray.filter((item) => item !== "Tidak ada");
    setSelectedCondition(cleaned);
  };

  const handleSearch = async () => {
    setErrorMessage(null);

    if (!promptText.trim()) {
      setErrorMessage({ type: "Input Kosong", text: "Mohon deskripsikan keluhan atau diagnosis Anda." });
      return;
    }
    if (selectedCondition.length === 0 || selectedDrug.length === 0) {
      setErrorMessage({ type: "Keamanan Pasien", text: "Mohon lengkapi bagian 'Kondisi Khusus' dan 'Konsumsi Obat Kimia' demi keselamatan." });
      return;
    }

    const userWallet = localStorage.getItem('user_wallet') || "guest_user";
    
    // Payload khusus untuk endpoint SBERT di Backend
    const payload = {
      wallet_address: userWallet,
      query_text: promptText, // Teks bebas untuk SBERT
      kondisi: selectedCondition,
      obat_kimia: selectedDrug
    };

    setIsLoading(true);
    setRecommendations(null);

    try {
      // PERHATIKAN: Kita arahkan ke endpoint yang berbeda khusus untuk SBERT (misal: /api/recommend_sbert)
        const res = await fetch("http://localhost:8000/api/recommend_hybrid", {        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error("Terjadi kesalahan pada server AI");
      
      const results = await res.json();
      
      setTimeout(() => {
        setRecommendations(results);
        setIsLoading(false);
        if (resultRef.current) resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 800);

    } catch (err) {
      console.error("API Error:", err);
      setErrorMessage({ type: "Gagal Menganalisis", text: "Sistem AI sedang sibuk atau terjadi kesalahan jaringan." });
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="absolute top-0 inset-x-0 h-[600px] bg-gradient-to-b from-indigo-50/80 to-transparent -z-10" />

      <div className="max-w-4xl mx-auto pt-16 px-4 pb-24 relative z-10">
        
        {/* Header Section */}
        <div className="text-center mb-10">
          <span className="bg-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase mb-4 inline-block">Sistem Cerdas Bertenaga AI</span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 mb-3">Pencarian Rekomendasi Pintar</h1>
          <p className="text-gray-500 max-w-xl mx-auto">
            Sistem SBERT (Sentence-BERT) kami akan menganalisis makna dari teks diagnosis Anda dan mencocokkannya dengan <strong>seluruh</strong> database tanaman herbal yang relevan.
          </p>
        </div>

        {/* Formulir SBERT */}
        <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100">
          <div className="p-8 md:p-10">
            
            <div className="mb-8">
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
                <FileText size={16} className="text-indigo-500" /> Deskripsi Klinis & Gejala
              </label>
              <textarea
                value={promptText}
                onChange={isFromDoctor ? undefined : (e) => setPromptText(e.target.value)}
                readOnly={isFromDoctor}
                className={`w-full p-5 border rounded-2xl outline-none transition text-gray-700 leading-relaxed min-h-[150px]
                  ${isFromDoctor
                    ? "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed resize-none"
                    : "bg-gray-50 border-gray-200 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 resize-y"
                  }`}
              />
              <p className="text-xs text-gray-400 mt-2 ml-1">
                {isFromDoctor
                  ? "Data ini berasal dari catatan dokter Anda dan tidak dapat diubah."
                  : "Ceritakan keluhan Anda untuk dianalisis oleh sistem AI."}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 border-t border-gray-100 pt-8">
              <MultiSelectField label="Kondisi Khusus Khusus Pasien" required options={specialConditionOptions} value={selectedCondition} onChange={handleConditionChange} />
              <SelectField label="Sedang Konsumsi Obat Kimia?" required options={chemicalDrugOptions} value={selectedDrug} onChange={(c) => setSelectedDrug([c])} closeOnSelect={true} />
            </div>

            {errorMessage && (
              <div className="mb-8 p-5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-4">
                <AlertTriangle size={20} className="text-danger-30 flex-shrink-0 mt-0.5" />
                <div><h4 className="font-bold text-red-800 text-sm mb-1">{errorMessage.type}</h4><p className="text-sm text-red-600">{errorMessage.text}</p></div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-end gap-4 pt-4">
              <button 
                onClick={() => navigate(-1)} 
                className="px-8 py-4 rounded-xl font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 transition-all"
              >
                Kembali
              </button>
              <button 
                onClick={handleSearch} 
                disabled={isLoading} 
                className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-10 py-4 rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <><Loader2 size={16} className="animate-spin" /> Memproses AI...</>
                ) : (
                  <><Sparkles size={16} /> Analisis dengan AI</>
                )}
              </button>
            </div>

          </div>
        </div>

        {/* Area Hasil */}
        <div ref={resultRef} className="scroll-mt-10 mt-10">
          {recommendations && (
            <ResultSection recommendations={recommendations} selectedDrug={selectedDrug} />
          )}
        </div>

      </div>
    </MainLayout>
  );
}