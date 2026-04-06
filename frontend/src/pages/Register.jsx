import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { connectWallet } from "../utils/web3Helpers";

// ─── Toast Component ────────────────────────────────────────────────────────
function Toast({ toasts, removeToast }) {
  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-4 px-5 py-4 rounded-2xl shadow-2xl border backdrop-blur-md max-w-sm w-full
            transform transition-all duration-500 animate-slide-in
            ${
              t.type === "success"
                ? "bg-white/90 border-green-200 text-green-800"
                : t.type === "error"
                  ? "bg-white/90 border-red-200 text-red-800"
                  : t.type === "warning"
                    ? "bg-white/90 border-orange-200 text-orange-800"
                    : "bg-white/90 border-blue-200 text-blue-800"
            }`}
        >
          <span className="text-2xl mt-0.5 flex-shrink-0">
            {t.type === "success"
              ? "✅"
              : t.type === "error"
                ? "❌"
                : t.type === "warning"
                  ? "⚠️"
                  : "ℹ️"}
          </span>
          <div className="flex-1">
            {t.title && <p className="font-bold text-sm mb-0.5">{t.title}</p>}
            <p className="text-sm leading-relaxed">{t.message}</p>
          </div>
          <button
            onClick={() => removeToast(t.id)}
            className="text-gray-400 hover:text-gray-600 transition text-lg leading-none flex-shrink-0 mt-0.5"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

const Register = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [registeredUser, setRegisteredUser] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const showToast = (type, title, message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Hapus error saat user mulai mengetik lagi
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: null });
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const newErrors = {};

    // 1. Validasi Nama
    if (!formData.name.trim()) {
      newErrors.name = "Nama lengkap wajib diisi";
    }

    // 2. Validasi Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      newErrors.email = "Email wajib diisi";
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "Format email salah (contoh: budi@email.com)";
    }

    // 3. Validasi Password (ANGKA 123 PASTI GAGAL DI SINI)
    // Syarat: Minimal 8 karakter, ada huruf BESAR, huruf kecil, angka, dan simbol
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!formData.password) {
      newErrors.password = "Kata sandi wajib diisi";
    } else if (!passwordRegex.test(formData.password)) {
      newErrors.password =
        "Harus 8+ karakter, ada huruf besar, kecil, angka, & simbol";
    }

    // 4. Validasi Konfirmasi Password
    if (formData.confirmPassword !== formData.password) {
      newErrors.confirmPassword = "Konfirmasi kata sandi tidak cocok";
    }

    // --- BAGIAN PALING KRUSIAL: SI GERBANG TOL ---
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors); // Tampilkan garis merah dan pesan error
      showToast(
        "error",
        "Pendaftaran Ditolak",
        "Input tidak sesuai kriteria keamanan.",
      );
      return; // <--- INI WAJIB ADA! Berfungsi untuk menghentikan kode agar tidak lanjut ke API
    }

    // Jika lolos dari 'return' di atas, baru jalankan proses kirim data
    setErrors({});
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:8000/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Pendaftaran gagal");

      setRegisteredUser(data.user);
      setStep(2);
    } catch (error) {
      showToast("error", "Gagal Mendaftar", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkWallet = async () => {
    setIsLoading(true);
    try {
      const address = await connectWallet();
      const response = await fetch("http://localhost:8000/api/connect-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: registeredUser.id,
          wallet_address: address,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menautkan wallet");

      localStorage.setItem("user_wallet", address);
      localStorage.setItem("user_profile", JSON.stringify(data.user));
      navigate("/home");
    } catch (error) {
      showToast("error", "Koneksi Gagal", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper untuk styling border merah
  const getInputClass = (fieldName) => {
    const baseClass =
      "mt-1 block w-full px-4 py-3 border rounded-xl shadow-sm sm:text-sm transition-all outline-none";
    if (errors[fieldName]) {
      return `${baseClass} border-red-500 bg-red-50 focus:ring-1 focus:ring-red-500`;
    }
    return `${baseClass} border-gray-300 focus:ring-1 focus:ring-primary-40`;
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans relative">
      <Toast toasts={toasts} removeToast={removeToast} />
      <style>{`
              @keyframes slide-in {
                0% { transform: translateX(100%); opacity: 0; }
                100% { transform: translateX(0); opacity: 1; }
              }
              .animate-slide-in { animation: slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
            `}</style>

      <div className="w-full md:w-1/2 flex flex-col justify-center items-center p-8 bg-white relative z-10">
        <div className="max-w-md w-full">
          {step === 1 ? (
            <div className="bg-white p-8 rounded-2xl shadow-xl">
              <div className="text-center mb-8">
                <h1 className="text-4xl font-extrabold text-primary-40 tracking-tight">
                  Herbalyze
                </h1>
                <h2 className="text-3xl font-bold text-gray-900 mt-2">
                  Buat Akun Baru
                </h2>
              </div>

              {/* KUNCI UTAMA: noValidate ditambahkan di sini */}
              <form className="space-y-6" onSubmit={handleRegister} noValidate>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Nama Lengkap
                  </label>
                  <input
                    name="name"
                    type="text"
                    className={getInputClass("name")}
                    placeholder="Sesuai KTP"
                    value={formData.name}
                    onChange={handleChange}
                  />
                  {errors.name && (
                    <p className="mt-1 text-[11px] text-red-500 font-medium ml-1">
                      ⚠️ {errors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Alamat Email
                  </label>
                  <input
                    name="email"
                    type="email"
                    className={getInputClass("email")}
                    placeholder="contoh@email.com"
                    value={formData.email}
                    onChange={handleChange}
                  />
                  {errors.email && (
                    <p className="mt-1 text-[11px] text-red-500 font-medium ml-1">
                      ⚠️ {errors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <input
                      id="register-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      className={getInputClass("password")}
                      placeholder="Minimal 8 karakter"
                      value={formData.password}
                      onChange={handleChange}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                      tabIndex={-1}
                      aria-label={showPassword ? "Sembunyikan kata sandi" : "Lihat kata sandi"}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-[11px] text-red-500 font-medium ml-1">
                      ⚠️ {errors.password}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Konfirmasi Kata Sandi
                  </label>
                  <div className="relative">
                    <input
                      id="register-confirm-password"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      className={getInputClass("confirmPassword")}
                      placeholder="Ketik ulang kata sandi"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? "Sembunyikan konfirmasi kata sandi" : "Lihat konfirmasi kata sandi"}
                    >
                      {showConfirmPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-1 text-[11px] text-red-500 font-medium ml-1">
                      ⚠️ {errors.confirmPassword}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg shadow-primary-40/30 text-sm font-bold text-white bg-primary-40 hover:bg-primary-50 transition-all active:scale-95 mt-4"
                >
                  {isLoading ? "Memproses..." : "Daftar Akun"}
                </button>

                <p className="mt-4 text-center text-[11px] text-gray-400 leading-relaxed px-4">
                  Ingin mendaftar sebagai Tenaga Medis? Anda dapat mengajukan
                  verifikasi melalui
                  <span className="font-semibold text-gray-500">
                    {" "}
                    pengaturan profil{" "}
                  </span>
                  setelah akun aktif.
                </p>
              </form>
              <div className="text-center mt-6">
                <span
                  onClick={() => navigate("/")}
                  className="text-primary-40 text-sm font-medium cursor-pointer hover:underline"
                >
                  Sudah punya akun? Masuk di sini
                </span>
              </div>
            </div>
          ) : (
            // ... Bagian Step 2 (MetaMask) tidak berubah ...
            <div className="bg-white p-8 rounded-2xl shadow-xl text-center">
              <div className="mb-6 flex justify-center">
                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center animate-bounce">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg"
                    alt="MetaMask"
                    className="w-12 h-12"
                  />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Aktivasi Akun Anda
              </h2>
              <p className="text-gray-500 mb-8">
                Hubungkan dompet digital MetaMask untuk mengaktifkan keamanan
                data medis.
              </p>
              <button
                onClick={handleLinkWallet}
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-3 py-3 px-6 border border-gray-300 rounded-xl text-gray-800 bg-white hover:bg-gray-50 shadow-md transform transition hover:scale-105"
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg"
                  alt="MetaMask"
                  className="w-6 h-6"
                />
                <span className="font-bold">
                  Aktivasi dengan Dompet Digital
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sisi Kanan: Visual */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-b from-green-200 via-green-400 to-green-800 relative overflow-hidden flex-col justify-center items-center">
        <div className="relative z-10 text-center max-w-lg px-8">
          <div className="mb-8 transform hover:scale-105 transition duration-500">
            <div className="w-40 h-40 bg-white/30 backdrop-blur-md rounded-full mx-auto flex items-center justify-center shadow-2xl border border-white/40">
              <span className="text-6xl filter drop-shadow-lg">🌿</span>
            </div>
          </div>
          <h2 className="text-4xl font-extrabold text-white mb-4 drop-shadow-lg">
            Herbalyze
          </h2>
          <p className="text-white text-lg font-medium bg-white/20 p-5 rounded-xl backdrop-blur-sm shadow-lg leading-relaxed">
            "Kesehatanmu. Alami. Terlindungi."
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
