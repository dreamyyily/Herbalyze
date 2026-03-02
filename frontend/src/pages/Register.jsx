import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { connectWallet, signMessage } from '../utils/web3Helpers';

const Register = () => {
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    
    // Step 1: Register, Step 2: Link Wallet
    const [step, setStep] = useState(1);
    const [registeredUser, setRegisteredUser] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        
        if (formData.password !== formData.confirmPassword) {
            alert("Kata sandi tidak cocok! Silakan periksa kembali.");
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch('http://localhost:8000/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Pendaftaran gagal');

            // Sukses, lanjut ke Langkah 2 (Connect Wallet)
            setRegisteredUser(data.user);
            setStep(2);

        } catch (error) {
            alert(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLinkWallet = async () => {
        setIsLoading(true);
        try {
            // Langkah 1: Connect wallet dan dapatkan address
            const address = await connectWallet();
            
            // Langkah 2: Tautkan wallet ke akun
            const response = await fetch('http://localhost:8000/api/connect-wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: registeredUser.id,
                    wallet_address: address
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Gagal menautkan wallet');
            }

            // Sukses! Simpan sesi dan masuk ke Beranda
            localStorage.setItem('user_wallet', address);
            localStorage.setItem('user_profile', JSON.stringify(data.user));

            navigate('/home');

        } catch (error) {
            console.error("Kesalahan Tautkan Wallet:", error);
            alert("Gagal menautkan wallet: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col md:flex-row font-sans">
            {/* Sisi Kiri: Formulir */}
            <div className="w-full md:w-1/2 flex flex-col justify-center items-center p-8 bg-white relative z-10">
                <div className="max-w-md w-full">
                    {step === 1 ? (
                        // LANGKAH 1: FORMULIR PENDAFTARAN
                        <div className="bg-white p-8 rounded-2xl shadow-xl">
                            <div className="text-center mb-8">
                                <h1 className="text-4xl font-extrabold text-primary-40 tracking-tight">Herbalyze</h1>
                                <h2 className="text-3xl font-bold text-gray-900 mt-2">Buat Akun Baru</h2>
                                <p className="text-gray-500 mt-2">Bergabunglah dengan Herbalyze</p>
                            </div>

                            <form className="space-y-6" onSubmit={handleRegister}>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Nama Lengkap</label>
                                    <input 
                                        name="name" 
                                        type="text" 
                                        required 
                                        placeholder="Sesuai KTP"
                                        className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-primary-40 focus:border-primary-40 sm:text-sm transition-all"
                                        value={formData.name}
                                        onChange={handleChange}
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Alamat Email</label>
                                    <input 
                                        name="email" 
                                        type="email" 
                                        required 
                                        placeholder="contoh@email.com"
                                        className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-primary-40 focus:border-primary-40 sm:text-sm transition-all"
                                        value={formData.email}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Kata Sandi</label>
                                    <input 
                                        name="password" 
                                        type="password" 
                                        required 
                                        placeholder="Minimal 8 karakter"
                                        className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-primary-40 focus:border-primary-40 sm:text-sm transition-all"
                                        value={formData.password}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Konfirmasi Kata Sandi</label>
                                    <input 
                                        name="confirmPassword" 
                                        type="password" 
                                        required 
                                        placeholder="Ketik ulang kata sandi"
                                        className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-primary-40 focus:border-primary-40 sm:text-sm transition-all"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Peran Pengguna (Role)</label>
                                    <select disabled className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl shadow-sm sm:text-sm text-gray-500 cursor-not-allowed">
                                        <option>Pasien (Default)</option>
                                    </select>
                                    
                                    {/* --- INFORMASI TAMBAHAN UNTUK DOKTER --- */}
                                    <div className="mt-3 p-4 bg-blue-50/50 border border-blue-100 rounded-xl flex items-start gap-3">
                                        <div className="text-xl mt-0.5">🩺</div>
                                        <div>
                                            <h4 className="text-sm font-bold text-blue-800">Anda Tenaga Medis ?</h4>
                                            <p className="text-xs text-blue-600 mt-1 leading-relaxed">
                                                Seluruh akun didaftarkan sebagai Pasien pada awalnya. Anda dapat mengajukan verifikasi akses Dokter melalui menu Data Personal setelah pendaftaran selesai.
                                            </p>
                                        </div>
                                    </div>
                                    {/* -------------------------------------- */}
                                </div>

                                <button 
                                    type="submit" 
                                    disabled={isLoading}
                                    className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg shadow-primary-40/30 text-sm font-bold text-white bg-primary-40 hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-40 transition-all active:scale-95 mt-4"
                                >
                                    {isLoading ? 'Memproses...' : 'Daftar Akun'}
                                </button>
                            </form>
                            <div className="text-center mt-6">
                                <span onClick={() => navigate('/')} className="text-primary-40 text-sm font-medium cursor-pointer hover:underline">
                                    Sudah punya akun? Masuk di sini
                                </span>
                            </div>
                        </div>
                    ) : (
                        // LANGKAH 2: LINK WALLET
                        <div className="bg-white p-8 rounded-2xl shadow-xl text-center">
                            <div className="mb-6 flex justify-center">
                                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center animate-bounce">
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" alt="MetaMask" className="w-12 h-12" />
                                </div>
                            </div>
                            
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Hubungkan Wallet Anda</h2>
                            <p className="text-gray-500 mb-8">
                                Langkah terakhir! Tautkan dompet MetaMask Anda untuk mengamankan data medis ke dalam jaringan Blockchain.
                            </p>

                            <button 
                                onClick={handleLinkWallet}
                                disabled={isLoading}
                                className="w-full flex justify-center items-center gap-3 py-3 px-6 border border-gray-300 rounded-xl text-gray-800 bg-white hover:bg-gray-50 shadow-md transform transition hover:scale-105"
                            >
                                <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" alt="MetaMask" className="w-6 h-6" />
                                <span className="font-bold">Hubungkan MetaMask</span>
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
                    {/* Tagline utama tetap bahasa Inggris karena nama brand, atau bisa disesuaikan */}
                    <h2 className="text-4xl font-extrabold text-white mb-4 drop-shadow-lg">Herbalyze</h2>
                    <p className="text-white text-lg font-medium bg-white/20 p-5 rounded-xl backdrop-blur-sm shadow-lg leading-relaxed">
                        "Data kesehatan Anda dijamin aman oleh teknologi Blockchain. Rasakan pengalaman masa depan dalam rekomendasi pengobatan herbal."
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;