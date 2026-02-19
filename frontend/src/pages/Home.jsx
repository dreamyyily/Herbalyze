import MainLayout from "../layouts/MainLayout";
import SelectField from "../components/SelectField";
import { useEffect, useState } from "react";
import MultiSelectField from "../components/MultiSelectField";

export default function Home() {
  const [diagnosisOptions, setDiagnosisOptions] = useState([]);
  const [symptomOptions, setSymptomOptions] = useState([]);

  const specialConditionOptions = [
    "Tidak ada",
    "Ibu hamil",
    "Ibu menyusui",
    "Anak di bawah lima tahun"
  ];

  const chemicalDrugOptions =["Tidak", "Ya"];

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
    }  catch (err) {
      console.error("Error fetch symptoms:", err)
    }
  };

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto text-center mt-16 px-4">
        <h1 className="text-bold-24 text-dark-50 text-center mb-8">
          Temukan Rekomendasi Herbal yang Tepat sesuai Kebutuhan Medis Anda
        </h1>
        <p className="text-regular-15 text-dark-30 text-center mb-16 max-w-3xl mx-auto">
          Masukkan data kesehatan Anda dan dapatkan rekomendasi herbal yang aman, akurat, dan dipersonalisasi
        </p>

        <div className="bg-white rounded-xl shadow-md p-12 max-w-3xl mx-auto border border-light-40">
          <h2 className="text-bold-24 text-dark-50 mb-12">Data Medis</h2>

          <MultiSelectField label="Diagnosis Penyakit" options={diagnosisOptions}/>
          <MultiSelectField label="Gejala Yang Dialami" options={symptomOptions}/>
          <SelectField label="Kondisi Khusus" required options={specialConditionOptions}/>
          <SelectField label="Sedang Mengonsumsi Obat Kimia" required options={chemicalDrugOptions}/>

          <div className="flex justify-end gap-8 mt-20">
            <button className="bg-light-20 text-primary-40 border border-light-40 px-10 py-4 rounded-lg font-semibold hover:bg-light-30 transition">
              Kembali
            </button>
            <button className="bg-primary-40 text-white px-10 py-4 rounded-lg font-semibold hover:bg-primary-50 transition">
              Cari Rekomendasi
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}