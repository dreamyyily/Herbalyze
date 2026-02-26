import MainLayout from "../../layouts/MainLayout";
import SelectField from "../../components/SelectField";
import InputField from "../../components/InputField";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatTanggal } from "../../utils/formatTanggal";
import { validateRequired } from "../../utils/validateForm";
import { loadProfile, saveProfile } from "../../utils/storage";
import MultiSelectField from "../../components/MultiSelectField";

const genderOptions = ["Laki-laki", "Perempuan"];

export default function DataPersonal() {
  const navigate = useNavigate();
  const [photoPreview, setPhotoPreview] = useState(null);
  const [isEdit, setIsEdit] = useState(false);
  const [errors, setErrors] = useState({});
  const [doctorRequest, setDoctorRequest] = useState({
  isApplying: false,
  nomorSTR: "",
  institusi: "",
  dokumen: null,
});
  const [formData, setFormData] = useState({
    photo: null,
    nik: "",
    nama: "",
    tempatLahir: "",
    tanggalLahir: "",
    email: "",
    nomorHp: "",
    jenisKelamin: "",
    alergiHerbal: [],
  });
  const requiredFields = {
  nik: "NIK",
  nama: "Nama Lengkap",
  tanggalLahir: "Tanggal Lahir",
  email: "Email",
  alergiHerbal: "Alergi Herbal",
  };

  const isPersonalDataComplete = (showError = false) => {
  const newErrors = validateRequired(formData, requiredFields);

  if (Object.keys(newErrors).length > 0) {
    if (showError) setErrors(newErrors);
    return false;
  }

  return true;
};

  const [herbsOptions, setHerbsOptions] = useState([]);

  useEffect(() => {
  const wallet = localStorage.getItem("user_wallet");

  if (!wallet) {
    console.error("Wallet tidak ditemukan");
    return;
  }

  fetch(`http://127.0.0.1:8000/api/profile/${wallet}`)
    .then((res) => res.json())
    .then((data) => {
      setFormData((prev) => ({
        ...prev,
        nama: data.name || "",
        email: data.email || "",
        role: data.role,
      }));
    })
    .catch((err) => console.error("Gagal load profile:", err));

  fetch("http://127.0.0.1:8000/api/herbs")
    .then((res) => res.json())
    .then((data) => {
      const optionsWithNone = ["Tidak Ada", ...data];
      setHerbsOptions(optionsWithNone);
    })
    .catch((err) => console.error("Gagal load herbs:", err));
}, []);

  const handleDoctorChange = (e) => {
  const { name, value } = e.target;
  setDoctorRequest((prev) => ({ ...prev, [name]: value }));
};

const handleDoctorFile = (e) => {
  const file = e.target.files[0];
  if (file) {
    setDoctorRequest((prev) => ({ ...prev, dokumen: file }));
  }
};

const toggleDoctorApply = () => {
  if (!isPersonalDataComplete(true)) {
    alert("Lengkapi terlebih dahulu data personal yang wajib diisi sebelum mengajukan verifikasi dokter.");
    return;
  }

  setDoctorRequest((prev) => ({
    ...prev,
    isApplying: !prev.isApplying,
  }));
};

const handleSubmitDoctorRequest = async () => {
  if (!doctorRequest.nomorSTR || !doctorRequest.institusi || !doctorRequest.dokumen) {
    alert("Harap lengkapi Formulir (Nomor STR, Institusi, dan Upload Dokumen).");
    return;
  }

  const walletAddress = localStorage.getItem("user_wallet");
  if (!walletAddress) {
    alert("Silakan login dengan wallet Anda terlebih dahulu.");
    return;
  }

  const formPayload = new FormData();
  formPayload.append("wallet_address", walletAddress);
  formPayload.append("nomor_str", doctorRequest.nomorSTR);
  formPayload.append("nama_instansi", doctorRequest.institusi);
  formPayload.append("file_dokumen", doctorRequest.dokumen);

  try {
    const response = await fetch("http://localhost:8000/api/request_doctor", {
      method: "POST",
      body: formPayload, 
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || data.error || "Gagal mengajukan permintaan.");
    }

    alert("Berhasil: " + data.message);
    setDoctorRequest({ isApplying: false, nomorSTR: "", institusi: "", dokumen: null });
  } catch (err) {
    alert("Error: " + err.message);
  }
};

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
    if (name === "alergiHerbal") {
    if (value.includes("Tidak Ada")) {
      value = ["Tidak Ada"];
    }
  }

    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: ""}));
  };

  const handleSimpan = () => {
  const newErrors = validateRequired(formData, requiredFields);
  if (!formData.alergiHerbal || formData.alergiHerbal.length === 0) {
    newErrors.alergiHerbal = "Pilih minimal satu (atau pilih 'Tidak Ada')";
  }

  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors);
    return;
  }

  saveProfile(formData);
  alert("Data berhasil disimpan!");
  navigate("/");
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

            {formData.role === 'Doctor' && (
              <div className="mt-12 p-6 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                  🩺
                </div>
                <div>
                  <h4 className="text-lg font-bold text-blue-800">Dokter Terverifikasi</h4>
                  <p className="text-sm text-blue-600 mt-1">Akun ini telah melalui validasi Admin dan memiliki wewenang untuk mencatat rekam medis.</p>
                </div>
              </div>
            )}
            
            {formData.role === 'Pending_Doctor' && (
              <div className="mt-12 p-6 bg-yellow-50 border border-yellow-200 rounded-2xl flex items-center gap-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600">
                  ⏳
                </div>
                <div>
                  <h4 className="text-lg font-bold text-yellow-800">Menunggu Verifikasi Admin</h4>
                  <p className="text-sm text-yellow-600 mt-1">Dokumen STR Anda sedang dalam antrean pengecekan. Mohon bersabar.</p>
                </div>
              </div>
            )}

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
            <InputField label="Email" name="email" type="email" placeholder="mail@example.com" value={formData.email} disabled required error={errors.email} />
            <InputField label="Nomor HP" name="nomorHp" placeholder="08xx" value={formData.nomorHp} onChange={handleInputChange} />
            <SelectField label="Jenis Kelamin" options={genderOptions} value={formData.jenisKelamin} onChange={(value) => handleSelectChange("jenisKelamin", value)} />
            <MultiSelectField label="Alergi Herbal" options={herbsOptions} value={formData.alergiHerbal} onChange={(value) => handleSelectChange("alergiHerbal", value)} required error={errors.alergiHerbal} />
          </div>

          {(!formData.role || formData.role === 'Patient') && (
            <div className="mt-12 border-t border-primary-20">
              <h3 className="mt-3 text-bold-20 text-primary-50 mb-2">
                Ajukan Verifikasi Dokter
              </h3>

              <p className="text-regular-14 text-dark-30 mb-8">
                Jika Anda adalah tenaga medis profesional, Anda dapat mengajukan verifikasi untuk mendapatkan akses sebagai dokter di platform ini.
              </p>

            {!doctorRequest.isApplying ? (
              <button
                onClick={toggleDoctorApply}
                className={`px-8 py-3 rounded-2xl font-semibold border transition-all duration-200 shadow-sm active:scale-[0.98]
                ${
                  isPersonalDataComplete()
                    ? "border-primary-40 text-primary-40 hover:bg-primary-40 hover:text-white hover:shadow-md"
                    : "border-light-40 text-light-50 cursor-not-allowed"
                }`}
              >
                Ajukan Verifikasi
              </button>
            ) : (
              <div className="bg-white rounded-2xl p-6 space-y-6 border border-primary-30 ring-1 ring-primary-30 shadow-md">
                <InputField label="Nomor STR (Surat Tanda Registrasi)" name="nomorSTR" placeholder="Masukkan nomor STR" value={doctorRequest.nomorSTR} onChange={handleDoctorChange} />
                <InputField label="Institusi / Rumah Sakit" name="institusi" placeholder="RS Sehat Sejati" value={doctorRequest.institusi} onChange={handleDoctorChange} />

                <div>
                  <label className="text-regular-14 text-dark-40 block mb-2">
                    Upload Dokumen Pendukung (STR / SIP)
                  </label>
                  <label className="block">
                    <div className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition ${doctorRequest.dokumen ? 'border-green-500 bg-green-50' : 'border-primary-30 hover:bg-primary-10'}`}>
                      {doctorRequest.dokumen ? (
                        <p className="text-green-700 font-medium font-bold">
                          ✓ File terpilih: {doctorRequest.dokumen.name}
                        </p>
                      ) : (
                        <div>
                          <p className="text-primary-40 font-medium">
                            Klik untuk upload dokumen
                          </p>
                          <p className="text-xs text-dark-30 mt-1">
                            PDF / JPG / PNG
                          </p>
                        </div>
                      )}
                    </div>
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleDoctorFile} />
                  </label>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={handleSubmitDoctorRequest}
                    className="bg-primary-40 text-white px-8 py-3 rounded-2xl font-semibold hover:bg-primary-50 transition-all duration-200 shadow-sm hshadow-md active:scale-[0.97]">
                    Kirim Permintaan
                  </button>

                  <button
                    onClick={toggleDoctorApply}
                    className="px-6 py-3 rounded-2xl text-dark-40 hover:bg-light-20 transition-all"
                  >
                    Batal
                  </button>
                </div>
              </div>
              )}
            </div>
          )}

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
