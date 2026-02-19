import MainLayout from "../layouts/MainLayout";
import SelectField from "../components/SelectField";
import InputField from "../components/InputField";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatTanggal } from "../utils/formatTanggal";
import { validateRequired } from "../utils/validateForm";
import { loadProfile, saveProfile } from "../utils/storage";
import MultiSelectField from "../components/MultiSelectField";

const genderOptions = ["Laki-laki", "Perempuan"];

export default function DataPersonal() {
  const navigate = useNavigate();
  const [photoPreview, setPhotoPreview] = useState(null);
  const [isEdit, setIsEdit] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    photo: null,
    nik: "",
    nama: "",
    tempatLahir: "",
    tanggalLahir: "",
    email: "",
    nomorHp: "",
    jenisKelamin: "",
    alergiHerbal: "",
  });
  const requiredFields = {
  nik: "NIK",
  nama: "Nama Lengkap",
  tanggalLahir: "Tanggal Lahir",
  email: "Email",
  alergiHerbal: "Alergi Herbal",
  };

  const [herbsOptions, setHerbsOptions] = useState([]);

  useEffect(() => {
  const profile = loadProfile();
  if (profile) {
    setFormData(profile);
    setPhotoPreview(profile.photo);
  }

  fetch("http://127.0.0.1:8000/api/herbs")
  .then((res) => res.json())
  .then((data) => setHerbsOptions(data))
  .catch((err) => console.error("Gagal load herbs:", err));
}, []);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        alert("Ukuran file maksimal 4MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        setPhotoPreview(result);
        setFormData((prev) => ({ ...prev, photo: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: ""}));
  };

  const handleSelectChange = (name, value) =>{
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: ""}));
  };

  const handleSimpan = () => {
  const newErrors = validateRequired(formData, requiredFields);

  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors);
    return;
  }

  saveProfile(formData);
  setIsEdit(false);
};

  const handleEdit = () => {
    setIsEdit(true);
  };

  const handleBack = () => {
    navigate("/");
  };

  // Detail
  if (!isEdit) {
    return(
      <MainLayout>
        <div className="max-w-5xl mx-auto px-4 mt-16">
          <div className="bg-white rounded-3xl shadow-2xl p-12 border border-light-40">
            <div className="flex items-center gap-8 mb-16">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary-40 shadow-md">
                <img
                  src={photoPreview || formData.photo || "https://via.placeholder.com/150"}
                  alt="Profil"
                  className="w-full h-full object-cover"
                />
              </div>
              <h1 className="text-bold-24 text-dark-50">{formData.nama || "Nama User"}</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-8 text-regular-16">
              <div>
                <p className="text-dark-30 mb-2">NIK</p>
                <p className="text-dark-50">{formData.nik || "-"}</p>
              </div>
              <div>
                <p className="text-dark-30 mb-2">Nama Lengkap</p>
                <p className="text-dark-50">{formData.nama || "-"}</p>
              </div>
              <div>
                <p className="text-dark-30 mb-2">Tempat Lahir</p>
                <p className="text-dark-50">{formData.tempatLahir || "-"}</p>
              </div>
              <div>
                <p className="text-dark-30 mb-2">Tanggal Lahir</p>
                <p className="text-dark-50">{formatTanggal(formData.tanggalLahir)}</p>
              </div>
              <div>
                <p className="text-dark-30 mb-2">Email</p>
                <p className="text-dark-50">{formData.email || "-"}</p>
              </div>
              <div>
                <p className="text-dark-30 mb-2">Nomor HP</p>
                <p className="text-dark-50">{formData.nomorHp || "-"}</p>
              </div>
              <div>
                <p className="text-dark-30 mb-2">Jenis Kelamin</p>
                <p className="text-dark-50">{formData.jenisKelamin || "-"}</p>
              </div>
              <div>
                <p className="text-dark-30 mb-2">Alergi Herbal</p>
                <p className="text-dark-50">{formData.alergiHerbal || "-"}</p>
              </div>
            </div>

            <div className="flex justify-end gap-8 mt-20">
              <button
                onClick={handleEdit}
                className="bg-primary-40 text-white px-10 py-4 rounded-lg font-semibold hover:bg-primary-50 transition"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      </MainLayout>
    )
  }

  // Edit
  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto px-4 mt-16">
        <div className="bg-white rounded-3xl shadow-2xl p-12 border border-light-40">
          <h2 className="text-bold-24 text-dark-50 mb-12">Informasi Personal</h2>

          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-32 h-32 rounded-full border-2 border-dashed border-light-40 flex items-center justify-center overflow-hidden bg-light-20">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Foto Profil" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-6xl text-light-50">+</span>
                  )}
                </div>
                <label className="absolute inset-0 cursor-pointer">
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </label>
              </div>
              <div>
                <p className="text-regular-16 text-dark-50 font-medium">Foto Profil</p>
                <p className="text-regular-14 text-dark-30">JPG, PNG dan Max 4MB</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
            <div className="md:col-span-2">
              <InputField label="NIK" name="nik" placeholder="Masukkan NIK" value={formData.nik} onChange={handleInputChange} required error={errors.nik} />
            </div>

            <div className="md:col-span-2">
              <InputField label="Nama Lengkap Sesuai ID (KTP atau Paspor)" name="nama" placeholder="Nama Lengkap" value={formData.nama} onChange={handleInputChange} required error={errors.nama} />
            </div>

            <InputField label="Tempat Lahir" name="tempatLahir" placeholder="Jakarta" value={formData.tempatLahir} onChange={handleInputChange} />
            <InputField label="Tanggal Lahir" name="tanggalLahir" type="date" value={formData.tanggalLahir} onChange={handleInputChange} required error={errors.tanggalLahir} />
            <InputField label="Email" name="email" type="email" placeholder="mail@example.com" value={formData.email} onChange={handleInputChange} required error={errors.email} />
            <InputField label="Nomor HP" name="nomorHp" placeholder="08xx" value={formData.nomorHp} onChange={handleInputChange} />
            <SelectField label="Jenis Kelamin" options={genderOptions} value={formData.jenisKelamin} onChange={(value) => handleSelectChange("jenisKelamin", value)} />
            <MultiSelectField label="Alergi Herbal" options={herbsOptions} value={formData.alergiHerbal} onChange={(value) => handleSelectChange("alergiHerbal", value)} required error={errors.alergiHerbal} />
          </div>

          <div className="flex justify-end mt-16">
            <button onClick={handleSimpan} className="bg-primary-40 text-white px-12 py-5 rounded-2xl font-semibold hover:bg-primary-50 transition text-regular-16">
              Simpan
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
