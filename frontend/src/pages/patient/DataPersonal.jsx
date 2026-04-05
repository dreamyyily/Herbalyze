import MainLayout from "../../layouts/MainLayout";
import SelectField from "../../components/SelectField";
import InputField from "../../components/InputField";
import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { formatTanggal } from "../../utils/formatTanggal";
import { validateRequired } from "../../utils/validateForm";
import MultiSelectField from "../../components/MultiSelectField";
import Avatar from "../../components/Avatar";
import { Pencil, AlertTriangle, FileText, Clock, CheckCircle } from "lucide-react";

const genderOptions = ["Laki-laki", "Perempuan"];

export default function DataPersonal() {
  const navigate = useNavigate();
  const location = useLocation(); 
  const [photoPreview, setPhotoPreview] = useState(null);
  
  const [isEdit, setIsEdit] = useState(location.state?.fromHomeLock || false); 
  const [errors, setErrors] = useState({});
  
  // Modal States
  const [isDoctorModalOpen, setIsDoctorModalOpen] = useState(false);
  const [isIncompleteModalOpen, setIsIncompleteModalOpen] = useState(false);
  
  // --- STATE BARU: Modal Hasil Dinamis (Toast) ---
  const [actionResult, setActionResult] = useState({
    isOpen: false,
    type: 'success', 
    title: '',
    message: ''
  });

  const toastTimer = useRef(null);

  const fieldRefs = {
    nik: useRef(null),
    nama: useRef(null),
    tanggalLahir: useRef(null),
    alergiHerbal: useRef(null),
  };

  const [doctorRequest, setDoctorRequest] = useState({ nomorSTR: "", institusi: "", dokumen: null });
  const [strError, setStrError] = useState("");
  const [isEditInstansiOpen, setIsEditInstansiOpen] = useState(false);
  const [newInstansi, setNewInstansi] = useState("");
  const [isSubmittingInstansi, setIsSubmittingInstansi] = useState(false);
  const [dokumenSIP, setDokumenSIP] = useState(null);

  const [formData, setFormData] = useState({ photo: null, nik: "", nama: "", tempatLahir: "", tanggalLahir: "", email: "", nomorHp: "", jenisKelamin: "", alergiHerbal: [] });
  const [originalData, setOriginalData] = useState(null);

  const requiredFields = { nik: "NIK", nama: "Nama Lengkap", tanggalLahir: "Tanggal Lahir", email: "Email", alergiHerbal: "Alergi Herbal" };
  const [herbsOptions, setHerbsOptions] = useState([]);

  // --- MENGATASI KONFLIK DI USE EFFECT ---
  useEffect(() => {
    const wallet = localStorage.getItem("user_wallet");
    if (!wallet) {
      console.error("Wallet tidak ditemukan");
      return;
    }

    fetch(`http://127.0.0.1:8000/api/profile/${wallet}`)
      .then((res) => res.json())
      .then((data) => {
        setFormData({
          photo: data.foto_profil || null,
          nik: data.nik || "",
          nama: data.name || "",
          tempatLahir: data.tempat_lahir || "",
          tanggalLahir: data.tanggal_lahir || "",
          email: data.email || "",
          nomorHp: data.nomor_hp || "",
          jenisKelamin: data.jenis_kelamin || "",
          alergiHerbal: data.alergi_herbal || [],
          instansi: data.nama_instansi || "",
          instansi_baru: data.instansi_baru || "", 
          role: data.role || "Patient",
          nomor_str: data.nomor_str || "",
        });
        setOriginalData({
          photo: data.foto_profil || null,
          nik: data.nik || "",
          nama: data.name || "",
          tempatLahir: data.tempat_lahir || "",
          tanggalLahir: data.tanggal_lahir || "",
          email: data.email || "",
          nomorHp: data.nomor_hp || "",
          jenisKelamin: data.jenis_kelamin || "",
          alergiHerbal: data.alergi_herbal || [],
          instansi: data.nama_instansi || "",
          instansi_baru: data.instansi_baru || "", 
          role: data.role || "Patient",
          nomor_str: data.nomor_str || "",
        });
        if (data.foto_profil) setPhotoPreview(data.foto_profil);
        // role n name to storage
        localStorage.setItem('user_profile', JSON.stringify({
          name: data.name, role: data.role
        }));
      }).catch((err) => console.error("Gagal load profile:", err));

    // Fetch Herbs Options
    fetch("http://127.0.0.1:8000/api/herbs")
      .then((res) => res.json())
      .then((data) => { setHerbsOptions(["Tidak Ada", ...data]); })
      .catch((err) => console.error("Gagal load herbs:", err));
  }, []);

  const showToast = (type, title, message) => {
    setActionResult({ isOpen: true, type, title, message });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setActionResult(prev => ({ ...prev, isOpen: false }));
    }, 3500);
  };

  const isPersonalDataComplete = (showError = false) => {
  const newErrors = validateRequired(formData, requiredFields);
  if (!formData.alergiHerbal || formData.alergiHerbal.length === 0) {
    newErrors.alergiHerbal = "Pilih minimal satu (atau pilih 'Tidak Ada')";
  }
  if (formData.nik && formData.nik.length !== 16) {
    newErrors.nik = "NIK harus tepat 16 digit angka";
  }
  if (Object.keys(newErrors).length > 0) {
    if (showError) {
      setErrors(newErrors);
      setTimeout(() => {
        const firstErrorField = Object.keys(newErrors)[0];
        const ref = fieldRefs[firstErrorField];
        if (ref?.current) {
          ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          const el = document.querySelector(`[name="${firstErrorField}"]`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 50);
    }
    return false;
  }
  return true;
};

  const handleOpenDoctorModal = () => {
    if (!isPersonalDataComplete(true)) { setIsIncompleteModalOpen(true); return; }
    setIsDoctorModalOpen(true);
  };

  const handleDoctorChange = (e) => {
    const { name, value } = e.target;
    if (name === "nomorSTR") {
      // Tolak karakter spasi, simbol, huruf. Hanya izinkan angka murni (0-9).
      if (value !== "" && !/^\d+$/.test(value)) return;
      // Tolak jika melebihi 16 digit
      if (value.length > 16) return;
      // Validasi dan set pesan error
      if (value.length === 0) {
        setStrError("Nomor STR wajib diisi dengan angka.");
      } else if (value.length < 16) {
        setStrError(`Validasi gagal: Masih kurang ${16 - value.length} digit. (Harus tepat 16 digit angka)`);
      } else {
        setStrError(""); // Valid!
      }
    }
    setDoctorRequest((prev) => ({ ...prev, [name]: value.toUpperCase() }));
  };
  const handleDoctorFile = (e) => { const file = e.target.files[0]; if (file) setDoctorRequest((prev) => ({ ...prev, dokumen: file })); };

  // --- FUNGSI REQUEST DOKTER ---
  const handleSubmitDoctorRequest = async () => {
    if (!doctorRequest.nomorSTR || !doctorRequest.institusi || !doctorRequest.dokumen) { 
      showToast('danger', 'Data Belum Lengkap', 'Harap lengkapi nomor STR, institusi, dan dokumen pendukung.');
      return; 
    }
    const walletAddress = localStorage.getItem("user_wallet");
    if (!walletAddress) { 
      showToast('danger', 'Sesi Tidak Valid', 'Silakan login dengan wallet Anda terlebih dahulu.');
      return; 
    }

    const formPayload = new FormData();
    formPayload.append("wallet_address", walletAddress); 
    formPayload.append("nomor_str", doctorRequest.nomorSTR); 
    formPayload.append("nama_instansi", doctorRequest.institusi); 
    formPayload.append("file_dokumen", doctorRequest.dokumen);

    try {
      const response = await fetch("http://localhost:8000/api/request_doctor", { method: "POST", body: formPayload });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || data.error || "Gagal mengajukan permintaan.");
      
      setDoctorRequest({ nomorSTR: "", institusi: "", dokumen: null }); 
      setIsDoctorModalOpen(false); 
      setFormData(prev => ({...prev, role: 'Pending_Doctor'}));
      setOriginalData(prev => ({...prev, role: 'Pending_Doctor'}));

      showToast('success', 'Pengajuan Berhasil', 'Dokumen STR Anda telah dikirim dan sedang dalam antrean verifikasi Admin.');

    } catch (err) { 
      setIsDoctorModalOpen(false);
      showToast('danger', 'Terjadi Kesalahan', err.message);
    }
  };

  const handleDismissRejection = async () => {
    const walletAddress = localStorage.getItem("user_wallet");
    if (!walletAddress) return;

    try {
      const response = await fetch("http://localhost:8000/api/reset_role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: walletAddress }),
      });

      if (!response.ok) throw new Error("Gagal mereset status");
      
      // Ambil ulang data profil dari server untuk memastikan sinkronisasi sempurna
      const profileRes = await fetch(`http://127.0.0.1:8000/api/profile/${walletAddress}`);
      if (profileRes.ok) {
         const data = await profileRes.json();
         const freshData = {
          photo: data.foto_profil || null,
          nik: data.nik || "",
          nama: data.name || "",
          tempatLahir: data.tempat_lahir || "",
          tanggalLahir: data.tanggal_lahir || "",
          email: data.email || "",
          nomorHp: data.nomor_hp || "",
          jenisKelamin: data.jenis_kelamin || "",
          alergiHerbal: data.alergi_herbal || [],
          instansi: data.nama_instansi || "",
          instansi_baru: data.instansi_baru || "", 
          role: data.role || "Patient",
          nomor_str: data.nomor_str || "",
        };
        setFormData(freshData);
        setOriginalData(freshData);
        localStorage.setItem('user_profile', JSON.stringify({
          name: data.name, role: data.role
        }));
      } else {
        setFormData(prev => ({...prev, role: 'Patient'}));
        setOriginalData(prev => ({...prev, role: 'Patient'}));
      }
    } catch (error) {
      console.error("Kesalahan saat dismiss rejection:", error);
    }
  };

  const handleSubmitGantiInstansi = async () => {
    if (!newInstansi.trim()) {
      showToast('danger', 'Data Kosong', 'Nama instansi baru tidak boleh kosong.');
      return;
    }
    if (!dokumenSIP) {
      showToast('danger', 'Dokumen Diperlukan', 'Harap upload dokumen SIP untuk instansi baru.');
      return;
    }
    const walletAddress = localStorage.getItem("user_wallet");
    if (!walletAddress) return;

    setIsSubmittingInstansi(true);
    try {
      const formPayload = new FormData();
      formPayload.append("wallet_address", walletAddress);
      formPayload.append("nama_instansi", newInstansi.trim());
      formPayload.append("file_sip", dokumenSIP);

      const res = await fetch("http://localhost:8000/api/doctor/update_instansi", {
        method: "POST",
        body: formPayload,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Gagal mengajukan perubahan instansi");

      setIsEditInstansiOpen(false);
      setNewInstansi("");
      setDokumenSIP(null);
      setFormData(prev => ({ ...prev, role: 'Pending_Doctor', instansi_baru: newInstansi.trim() }));
      setOriginalData(prev => ({ ...prev, role: 'Pending_Doctor', instansi_baru: newInstansi.trim() }));
      showToast('success', 'Pengajuan Dikirim', 'Perubahan instansi sedang menunggu verifikasi admin.');
    } catch (err) {
      showToast('danger', 'Gagal', err.message);
    } finally {
      setIsSubmittingInstansi(false);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) { 
        showToast('danger', 'File Terlalu Besar', 'Ukuran foto maksimal yang diizinkan adalah 4MB.');
        return; 
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result; setPhotoPreview(result); setFormData((prev) => ({ ...prev, photo: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (e) => {
  const { name, value } = e.target;

  if (name === "nik") {
    if (!/^\d*$/.test(value)) return; 
    if (value.length > 16) return;   
  }
  if (name === "nomorHp") {
    if (!/^\d*$/.test(value)) return; 
  }
  setFormData((prev) => ({ ...prev, [name]: value }));
  setErrors((prev) => ({ ...prev, [name]: "" }));
};

  const handleSelectChange = (name, value) => {
    if (name === "alergiHerbal") {
      const prevValue = formData.alergiHerbal || [];
      const hasTidakAdaNow = value.includes("Tidak Ada");
      const hadTidakAdaBefore = prevValue.includes("Tidak Ada");

      if (hasTidakAdaNow && !hadTidakAdaBefore) {
        // Jika user baru saja mengklik "Tidak Ada", hapus pilihan lain
        value = ["Tidak Ada"];
      } else if (hasTidakAdaNow && hadTidakAdaBefore && value.length > 1) {
        // Jika "Tidak Ada" sudah ada, lalu user klik herbal lain, hapus "Tidak Ada"
        value = value.filter(item => item !== "Tidak Ada");
      }
    }
    setFormData((prev) => ({ ...prev, [name]: value })); 
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSimpan = async () => {
    if (!isPersonalDataComplete(true)) return;

    const walletAddress = localStorage.getItem("user_wallet");
    if (!walletAddress) { showToast('danger', 'Sesi Tidak Valid', 'Silakan login ulang.'); return; }

    try {
      const payload = {
        wallet_address: walletAddress,
        nik: formData.nik,
        nama: formData.nama,
        tempat_lahir: formData.tempatLahir,
        tanggal_lahir: formData.tanggalLahir,
        nomor_hp: formData.nomorHp,
        jenis_kelamin: formData.jenisKelamin,
        alergi_herbal: formData.alergiHerbal,
        foto_profil: formData.photo || null,
      };

      const res = await fetch("http://localhost:8000/api/profile/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Gagal menyimpan profil");

      localStorage.setItem('user_profile', JSON.stringify({
        name: formData.nama, role: formData.role,
      }));

      if (location.state?.fromHomeLock) {
        navigate("/", { state: { profileUpdated: true } });
      } else {
        setOriginalData({ ...formData });
        setIsEdit(false);
        showToast('success', 'Penyimpanan Berhasil', 'Data profil personal Anda telah berhasil diperbarui.');
      }
    } catch (err) {
      showToast('danger', 'Gagal Menyimpan', err.message);
    }
  };

  const handleBatal = () => {
    if (originalData) {
      setFormData(originalData);
      setPhotoPreview(originalData.photo);
    }
    setErrors({});
    if (location.state?.fromHomeLock) navigate("/");
    else setIsEdit(false);
  };

  const today = new Date().toISOString().split("T")[0];

  if (!isEdit) {
    return (
      <MainLayout>
        <div className="max-w-5xl mx-auto px-4 mt-16 pb-20 relative">
          <div className="bg-white rounded-3xl shadow-2xl p-12 border border-light-40 relative">
            <button onClick={() => setIsEdit(true)} className="absolute top-10 right-10 bg-primary-10 text-primary-50 px-6 py-2.5 rounded-full font-bold hover:bg-primary-20 transition flex items-center gap-2">
              <Pencil size={14} /> Edit Profil
            </button>
            <div className="flex items-center gap-8 mb-16">
              <Avatar name={formData.nama} fotoProfil={photoPreview || formData.photo} size="xl" className="border-4 border-primary-40 shadow-md" />
              <h1 className="text-3xl font-extrabold text-dark-50">{formData.nama || "Nama User"}</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-8 text-regular-16">
              <div><p className="text-dark-30 text-sm font-semibold mb-1 uppercase tracking-wider">NIK</p><p className="text-dark-50 font-medium text-lg">{formData.nik || "-"}</p></div>
              <div><p className="text-dark-30 text-sm font-semibold mb-1 uppercase tracking-wider">Nama Lengkap</p><p className="text-dark-50 font-medium text-lg">{formData.nama || "-"}</p></div>
              <div><p className="text-dark-30 text-sm font-semibold mb-1 uppercase tracking-wider">Tempat Lahir</p><p className="text-dark-50 font-medium text-lg">{formData.tempatLahir || "-"}</p></div>
              <div><p className="text-dark-30 text-sm font-semibold mb-1 uppercase tracking-wider">Tanggal Lahir</p><p className="text-dark-50 font-medium text-lg">{formData.tanggalLahir ? formatTanggal(formData.tanggalLahir) : "-"}</p></div>
              <div><p className="text-dark-30 text-sm font-semibold mb-1 uppercase tracking-wider">Email</p><p className="text-dark-50 font-medium text-lg">{formData.email || "-"}</p></div>
              <div><p className="text-dark-30 text-sm font-semibold mb-1 uppercase tracking-wider">Nomor HP</p><p className="text-dark-50 font-medium text-lg">{formData.nomorHp || "-"}</p></div>
              <div><p className="text-dark-30 text-sm font-semibold mb-1 uppercase tracking-wider">Jenis Kelamin</p><p className="text-dark-50 font-medium text-lg">{formData.jenisKelamin || "-"}</p></div>
              <div><p className="text-dark-30 text-sm font-semibold mb-1 uppercase tracking-wider">Alergi Herbal</p><p className="text-dark-50 font-medium text-lg">{formData.alergiHerbal && formData.alergiHerbal.length > 0 ? formData.alergiHerbal.join(", ") : "-"}</p></div>
            </div>

            <div className="mt-16 border-t border-gray-100 pt-12">
              
              {formData.role === 'Doctor' && (
                <div className="p-6 bg-blue-50 border border-blue-200 rounded-2xl flex flex-col md:flex-row items-start md:items-center gap-5">
                  <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-2xl flex-shrink-0">🩺</div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-blue-800">Dokter Terverifikasi</h4>
                    <p className="text-blue-600 mt-1 text-sm">Akun Anda memiliki wewenang penuh untuk mencatat rekam medis pasien secara aman dan terenkripsi.</p>
                    <p className="text-blue-500 text-sm mt-2">
                      Instansi: <span className="font-bold">{formData.instansi || "-"}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => { setNewInstansi(formData.instansi || ""); setIsEditInstansiOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-blue-300 text-blue-600 hover:bg-blue-100 text-sm font-semibold transition whitespace-nowrap"
                  >
                    <Pencil size={14} /> Ganti Instansi
                  </button>
                </div>
              )}
              
              {formData.role === 'Pending_Doctor' && (
                <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-2xl flex items-center gap-5">
                  <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 text-2xl flex-shrink-0"><Clock className="w-7 h-7" /></div>
                  <div>
                    <h4 className="text-xl font-bold text-yellow-800">Menunggu Verifikasi Admin</h4>
                    {formData.nomor_str ? (
                      <p className="text-yellow-700 mt-1 text-sm">
                        Dokumen STR Anda sedang dalam antrean pengecekan. Mohon bersabar.
                      </p>
                    ) : (
                      <>
                        <p className="text-yellow-700 mt-1 text-sm">
                          Pengajuan perubahan instansi sedang menunggu persetujuan admin.
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          <span className="text-yellow-600">Instansi aktif:</span>
                          <span className="font-semibold text-yellow-800">{formData.instansi || "-"}</span>
                          <span className="text-yellow-400">→</span>
                          <span className="text-yellow-600">Diajukan:</span>
                          <span className="font-semibold text-blue-700">{formData.instansi_baru || "-"}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {formData.role === 'Rejected_Doctor' && (
                <div className="p-8 bg-red-50/80 border border-red-200 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 mt-1 bg-red-100 rounded-full flex items-center justify-center text-red-600 text-xl flex-shrink-0">⚠️</div>
                    <div>
                      <h4 className="text-xl font-bold text-red-800">Pengajuan Ditolak</h4>
                      <p className="text-red-700 mt-1 leading-relaxed text-sm">
                        {formData.nomor_str
                          ? "Maaf, pengajuan dokumen STR Anda ditolak oleh Admin karena dokumen terindikasi tidak valid atau buram. Anda dapat mencoba mengajukan ulang atau membatalkan pengajuan."
                          : "Maaf, pengajuan perubahan instansi Anda ditolak oleh Admin. Instansi Anda tetap seperti sebelumnya. Anda bisa mencoba mengajukan ulang jika diperlukan."
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 w-full md:w-auto">
                    <button onClick={handleOpenDoctorModal} className="bg-red-500 hover:bg-red-600 text-white px-6 py-3.5 rounded-xl font-bold transition-all shadow-md active:scale-95 whitespace-nowrap">
                      Ajukan Ulang Verifikasi
                    </button>
                    <button onClick={handleDismissRejection} className="bg-transparent hover:bg-red-100 text-red-600 border border-red-200 px-6 py-3 rounded-xl font-semibold transition-all">
                      Batalkan Pengajuan
                    </button>
                  </div>
                </div>
              )}

              {(!formData.role || formData.role === 'Patient') && (
                <div className="bg-primary-10/30 p-8 rounded-[2rem] border border-primary-20 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm hover:shadow-md transition">
                  <div className="flex-1">
                    <h3 className="text-xl font-extrabold text-primary-60">Tenaga Medis Profesional?</h3>
                    <p className="text-dark-40 mt-2 leading-relaxed">Dapatkan akses eksklusif untuk mendiagnosis dan mencatat rekam medis herbal pasien dengan mendaftarkan STR (Surat Tanda Registrasi) Anda.</p>
                  </div>
                  <button onClick={handleOpenDoctorModal} className="bg-primary-40 hover:bg-primary-50 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-md active:scale-95 whitespace-nowrap">
                    Ajukan Verifikasi Dokter
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* MODAL PENGAJUAN DOKTER */}
        {isDoctorModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl p-8 max-h-[95vh] overflow-y-auto relative">
              <div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-extrabold text-dark-50">Pengajuan Akses Dokter</h3><button onClick={() => setIsDoctorModalOpen(false)} className="text-gray-400 hover:text-red-500 text-3xl font-bold leading-none w-10 h-10 flex items-center justify-center rounded-full hover:bg-red-50 transition">&times;</button></div>
              <p className="text-gray-500 mb-8">Silakan lengkapi data profesi Anda di bawah ini untuk proses validasi legalitas oleh Admin sistem.</p>
              <div className="space-y-6">
                {/* ─── Field Nomor STR dengan validasi penuh ─── */}
                <div>
                  <InputField 
                    label="Nomor STR (Surat Tanda Registrasi)" 
                    name="nomorSTR" 
                    placeholder="Masukkan tepat 16 digit angka" 
                    value={doctorRequest.nomorSTR} 
                    onChange={handleDoctorChange}
                    error={strError}
                    required
                  />
                  <div className="flex justify-between items-center mt-1.5 px-1">
                    <p className="text-[11px] text-gray-400">Hanya angka murni (0-9), tidak boleh ada huruf, spasi, atau simbol.</p>
                    <span className={`text-xs font-bold tabular-nums ${
                      doctorRequest.nomorSTR.length === 16 ? "text-green-500" : strError ? "text-red-400" : "text-gray-400"
                    }`}>
                      {doctorRequest.nomorSTR.length}/16
                    </span>
                  </div>
                  {!strError && doctorRequest.nomorSTR.length === 16 && (
                    <p className="mt-1 px-1 text-xs text-green-600 font-medium flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Nomor STR valid — 16 digit terpenuhi.
                    </p>
                  )}
                </div>
                <InputField label="Institusi / Rumah Sakit Utama" name="institusi" placeholder="Contoh: RSUD Sehat Sejahtera" value={doctorRequest.institusi} onChange={handleDoctorChange} />
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">Upload Dokumen Pendukung (STR / SIP Aktif)</label>
                  <label className="block">
                    <div className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${doctorRequest.dokumen ? 'border-green-500 bg-green-50' : 'border-primary-30 hover:bg-primary-10/50'}`}>
                      {doctorRequest.dokumen ? (<div><div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3 text-xl"><CheckCircle className="w-6 h-6" /></div><p className="text-green-800 font-bold break-all">{doctorRequest.dokumen.name}</p></div>) : (<div><div className="w-12 h-12 bg-primary-10 text-primary-50 rounded-full flex items-center justify-center mx-auto mb-3 text-xl"><FileText className="w-6 h-6" /></div><p className="text-primary-50 font-bold text-lg">Pilih Dokumen</p><p className="text-sm text-gray-500 mt-2">Mendukung PDF, JPG, atau PNG (Max. 5MB)</p></div>)}
                    </div>
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleDoctorFile} />
                  </label>
                </div>
              </div>
              <div className="flex gap-4 mt-10">
                <button onClick={() => { setIsDoctorModalOpen(false); setStrError(""); setDoctorRequest({ nomorSTR: "", institusi: "", dokumen: null }); }} className="flex-1 px-6 py-4 rounded-xl text-gray-600 bg-gray-100 hover:bg-gray-200 font-bold transition">Batal</button>
                <button
                  onClick={handleSubmitDoctorRequest}
                  disabled={doctorRequest.nomorSTR.length !== 16 || !!strError || !doctorRequest.institusi || !doctorRequest.dokumen}
                  className="flex-1 bg-primary-40 text-white px-6 py-4 rounded-xl font-bold hover:bg-primary-50 shadow-md transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  Kirim Permintaan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL PROFIL BELUM LENGKAP */}
        {isIncompleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-50/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-[420px] p-8 md:p-10 text-center transform transition-all border border-gray-100">
              <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 border-[8px] border-amber-50/50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">Profil Belum Lengkap</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-10 px-2">Harap lengkapi informasi data personal Anda terlebih dahulu sebelum mengajukan verifikasi akses Dokter.</p>
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button onClick={() => setIsIncompleteModalOpen(false)} className="flex-1 py-3.5 rounded-xl text-gray-500 bg-gray-50 hover:bg-gray-100 hover:text-gray-700 font-semibold transition-colors border border-transparent hover:border-gray-200">Nanti Saja</button>
                <button onClick={() => {setIsIncompleteModalOpen(false); setIsEdit(true);}} className="flex-1 py-3.5 rounded-xl text-white bg-primary-50 hover:bg-primary-60 font-semibold transition-all shadow-lg shadow-primary-50/30 active:scale-95">Lengkapi Sekarang</button>
              </div>
            </div>
          </div>
        )}

        {/* TOAST NOTIFICATION */}
        {actionResult.isOpen && (
          <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[60] animate-fade-in shadow-2xl rounded-2xl pointer-events-none">
            <div className={`px-6 py-4 rounded-2xl bg-white border-l-8 flex items-center gap-4 min-w-[350px] ${
              actionResult.type === 'success' ? 'border-l-green-500' : 'border-l-red-500'
            }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                actionResult.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}>
                {actionResult.type === 'success' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                )}
              </div>
              <div>
                <h4 className="font-bold text-gray-800 text-sm">
                  {actionResult.title}
                </h4>
                <p className="text-gray-500 text-xs mt-0.5">{actionResult.message}</p>
              </div>
            </div>
          </div>
        )}

        {/* MODAL GANTI INSTANSI */}
        {isEditInstansiOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-extrabold text-dark-50">Ganti Instansi Bekerja</h3>
                <button onClick={() => setIsEditInstansiOpen(false)} className="text-gray-400 hover:text-red-500 text-3xl font-bold leading-none w-10 h-10 flex items-center justify-center rounded-full hover:bg-red-50 transition">&times;</button>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                <p className="text-yellow-800 text-sm font-semibold mb-1"> <AlertTriangle className="w-6 h-6" /> Perlu Verifikasi Ulang</p>
                <p className="text-yellow-700 text-xs leading-relaxed">
                  Perubahan instansi memerlukan persetujuan admin. Status akun Anda akan berubah menjadi <strong>Menunggu Verifikasi</strong> hingga admin menyetujui.
                </p>
              </div>

              <div className="space-y-5 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nama Instansi Baru</label>
                <input
                  type="text"
                  value={newInstansi}
                  onChange={(e) => setNewInstansi(e.target.value)}
                  placeholder="Contoh: RSUD Harapan Baru"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary-40 focus:ring-2 focus:ring-primary-10 transition text-sm"
                />
                {formData.instansi && (
                  <p className="text-xs text-gray-400 mt-2">Instansi sebelumnya: <span className="font-medium">{formData.instansi}</span></p>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  Upload SIP (Surat Izin Praktik) Instansi Baru <span className="text-red-500">*</span>
                </label>
                <label className="block cursor-pointer">
                  <div className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all ${
                    dokumenSIP ? 'border-green-500 bg-green-50' : 'border-primary-30 hover:bg-primary-10/50'
                  }`}>
                    {dokumenSIP ? (
                      <div>
                        <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2 text-lg"><CheckCircle className="w-6 h-6" /></div>
                        <p className="text-green-800 font-bold text-sm break-all">{dokumenSIP.name}</p>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); setDokumenSIP(null); }}
                          className="text-xs text-red-500 mt-1 hover:underline"
                        >
                          Hapus file
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="w-10 h-10 bg-primary-10 text-primary-50 rounded-full flex items-center justify-center mx-auto mb-2 text-lg"><FileText className="w-6 h-6" /></div>
                        <p className="text-primary-50 font-bold text-sm">Pilih Dokumen SIP</p>
                        <p className="text-xs text-gray-400 mt-1">PDF, JPG, atau PNG (Max. 5MB)</p>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => { const file = e.target.files[0]; if (file) setDokumenSIP(file); }}
                  />
                </label>
              </div>
            </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setIsEditInstansiOpen(false); setNewInstansi(""); setDokumenSIP(null); }}
                  className="flex-1 px-6 py-3.5 rounded-xl text-gray-600 bg-gray-100 hover:bg-gray-200 font-bold transition"
                >
                  Batal
                </button>
                <button
                  onClick={handleSubmitGantiInstansi}
                  disabled={isSubmittingInstansi || !newInstansi.trim() || newInstansi.trim() === formData.instansi || !dokumenSIP}
                  className="flex-1 px-6 py-3.5 rounded-xl text-white bg-primary-40 hover:bg-primary-50 font-bold transition shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingInstansi ? "Mengirim..." : "Ajukan Perubahan"}
                </button>
              </div>
            </div>
          </div>
        )}

      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto px-4 mt-16 pb-20 relative">
        <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 border border-light-40 relative z-10">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-2xl md:text-3xl font-extrabold text-dark-50">Edit Data Personal</h2>
            <button onClick={handleBatal} className="text-gray-400 hover:text-dark-50 transition font-medium">Batal Edit</button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 mb-12 bg-gray-50 p-6 rounded-3xl border border-gray-100">
            <div className="relative group">
              <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-dashed border-primary-30 flex items-center justify-center overflow-hidden bg-white relative">
                {photoPreview || formData.photo ? (
                  <img src={photoPreview || formData.photo} alt="Foto Profil" className="w-full h-full object-cover group-hover:opacity-50 transition" />
                ) : (
                  <span className="text-4xl text-primary-30">+</span>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer">
                  <span className="text-white font-semibold text-sm">Ganti Foto</span>
                </div>
              </div>
              <label className="absolute inset-0 cursor-pointer">
                <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={handlePhotoChange} />
              </label>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-lg text-dark-50 font-bold">Foto Profil Pengguna</p>
              <p className="text-sm text-dark-30 mt-1 max-w-sm">Gunakan foto asli agar mudah dikenali. Format JPG/PNG, maksimal 4MB.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
            <div className="md:col-span-2">
              <div ref={fieldRefs.nik}>
                <InputField label="NIK (Nomor Induk Kependudukan)" name="nik" placeholder="Masukkan 16 digit NIK" value={formData.nik} onChange={handleInputChange} required error={errors.nik} />
                <p className={`text-xs mt-1 text-right ${formData.nik.length === 16 ? "text-green-500" : "text-dark-30"}`}>
                  {formData.nik.length} / 16 digit
                </p>
              </div>
            </div>
            <div className="md:col-span-2">
              <InputField label="Nama Lengkap Sesuai ID (KTP atau Paspor)" name="nama" placeholder="Tuliskan nama lengkap..." value={formData.nama} onChange={handleInputChange} required error={errors.nama} />
            </div>
            <InputField label="Tempat Lahir" name="tempatLahir" placeholder="Contoh: Jakarta" value={formData.tempatLahir} onChange={handleInputChange} />
            <div ref={fieldRefs.tanggalLahir}>
              <InputField label="Tanggal Lahir" name="tanggalLahir" type="date" value={formData.tanggalLahir} onChange={handleInputChange} max={today} required error={errors.tanggalLahir} />
            </div>
            <InputField label="Email Terdaftar" name="email" type="email" placeholder="mail@example.com" value={formData.email} disabled required error={errors.email} />
            <InputField label="Nomor Handphone" name="nomorHp" placeholder="Contoh: 08123456789" value={formData.nomorHp} onChange={handleInputChange} />
            <SelectField label="Jenis Kelamin" options={genderOptions} value={formData.jenisKelamin} onChange={(value) => handleSelectChange("jenisKelamin", value)} />
            <div ref={fieldRefs.alergiHerbal}>
                <MultiSelectField label="Alergi Herbal (Pilih lebih dari satu jika ada)" options={herbsOptions} value={formData.alergiHerbal} onChange={(value) => handleSelectChange("alergiHerbal", value)} required error={errors.alergiHerbal} />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-4 mt-16 pt-10 border-t border-gray-100">
            <button 
              onClick={handleBatal}
              className="w-full sm:w-auto px-8 py-4 text-gray-500 hover:bg-gray-100 rounded-xl font-bold transition-colors"
            >
              Batal
            </button>
            <button 
              onClick={handleSimpan} 
              className="w-full sm:w-auto bg-primary-50 text-white px-10 py-4 rounded-xl font-bold hover:bg-primary-60 transition-all shadow-lg shadow-primary-50/30 active:scale-95 flex items-center justify-center"
            >
              Simpan
            </button>
          </div>

        </div>

        {/* TOAST NOTIFICATION UNTUK MODE EDIT */}
        {actionResult.isOpen && (
          <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[60] animate-fade-in shadow-2xl rounded-2xl pointer-events-none">
            <div className={`px-6 py-4 rounded-2xl bg-white border-l-8 flex items-center gap-4 min-w-[350px] ${
              actionResult.type === 'success' ? 'border-l-green-500' : 'border-l-red-500'
            }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                actionResult.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}>
                {actionResult.type === 'success' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                )}
              </div>
              <div>
                <h4 className="font-bold text-gray-800 text-sm">
                  {actionResult.title}
                </h4>
                <p className="text-gray-500 text-xs mt-0.5">{actionResult.message}</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
}