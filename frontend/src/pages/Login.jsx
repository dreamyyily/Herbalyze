import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { connectWallet, signMessage, requestNonce } from '../utils/web3Helpers'; 

const Login = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [loginData, setLoginData] = useState({ email: '', password: '' });
    const navigate = useNavigate();

    const handleChange = (e) => {
        setLoginData({ ...loginData, [e.target.name]: e.target.value });
    };

    // 1. Masuk Tradisional (Email/Kata Sandi)
    const handleEmailLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const response = await fetch('http://localhost:8000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginData)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Gagal masuk');
            
            // Simpan sesi dasar
            localStorage.setItem('user_profile', JSON.stringify(data.user));
            if (data.user.wallet_address) {
                localStorage.setItem('user_wallet', data.user.wallet_address);
            }
            
            if (data.user.role === 'Admin') {
                navigate('/admin');
            } else {
                navigate('/home');
            }

        } catch (error) {
            alert(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // 2. Masuk MetaMask (Berbasis Tanda Tangan, GRATIS - tanpa biaya gas)
    const handleConnectMetaMask = async () => {
        setIsLoading(true);
        try {
            // Langkah 1: Hubungkan wallet dan dapatkan alamat (address)
            const address = await connectWallet();
            
            // Langkah 2: DAPATKAN NONCE DARI BACKEND !!
            const nonce = await requestNonce(address);
            
            // Langkah 3: Tanda tangani pesan (GRATIS - tanpa biaya gas, hanya tanda tangan)
            const signedData = await signMessage(nonce);
            
            // Langkah 4: Kirim ke backend untuk verifikasi
            const response = await fetch('http://localhost:8000/api/verify_signature', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: signedData.address,
                    signature: signedData.signature
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Gagal masuk');
            }

            // Langkah 5: Simpan sesi dan arahkan
            localStorage.setItem('user_wallet', signedData.address);
            if (data.user) {
                localStorage.setItem('user_profile', JSON.stringify(data.user));
            }

            navigate('/home');

        } catch (error) {
            console.error("Kesalahan Masuk MetaMask:", error);
            alert("Gagal masuk: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col md:flex-row font-sans">
            {/* Sisi Kiri: Interaksi */}
            <div className="w-full md:w-1/2 flex flex-col justify-center items-center p-8 bg-white relative z-10">
                <div className="max-w-md w-full space-y-8">
                    <div className="text-center">
                        <h1 className="text-4xl font-extrabold text-primary-40 tracking-tight">Herbalyze</h1>
                        <p className="mt-2 text-sm text-gray-500">Selamat datang kembali! Silakan masuk ke akun Anda.</p>
                    </div>

                    <form className="mt-8 space-y-6" onSubmit={handleEmailLogin}>
                        <div className="rounded-md shadow-sm -space-y-px">
                            <div>
                                <label htmlFor="email-address" className="sr-only">Alamat Email</label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    required
                                    className="appearance-none rounded-t-md relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-40 focus:border-primary-40 focus:z-10 sm:text-sm"
                                    placeholder="Alamat email"
                                    value={loginData.email}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label htmlFor="password" className="sr-only">Kata Sandi</label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    className="appearance-none rounded-b-md relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-40 focus:border-primary-40 focus:z-10 sm:text-sm"
                                    placeholder="Kata sandi"
                                    value={loginData.password}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-md text-white bg-primary-40 hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-40 transition-all"
                            >
                                {isLoading ? 'Memproses...' : 'Masuk'}
                            </button>
                        </div>
                    </form>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500">Atau masuk melalui jaringan Blockchain</span>
                        </div>
                    </div>

                    <button
                        onClick={handleConnectMetaMask}
                        disabled={isLoading}
                        className="w-full flex justify-center items-center gap-3 py-3 px-6 border border-gray-300 rounded-xl text-gray-700 bg-white hover:bg-gray-50 shadow-sm transform transition hover:scale-[1.01]"
                    >
                         <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" alt="MetaMask" className="w-6 h-6" />
                        <span className="font-semibold">Masuk dengan MetaMask</span>
                    </button>

                    <div className="text-center mt-4">
                        <p className="text-sm text-gray-600">
                            Belum punya akun?{' '}
                            <span 
                                onClick={() => navigate('/register')} 
                                className="font-medium text-primary-40 hover:text-primary-50 cursor-pointer"
                            >
                                Daftar di sini
                            </span>
                        </p>
                    </div>
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
                    <h2 className="text-4xl font-extrabold text-white mb-4 drop-shadow-lg">Herbalyze</h2>
                    <p className="text-white text-lg font-medium bg-white/20 p-5 rounded-xl backdrop-blur-sm shadow-lg leading-relaxed">
                        "Data kesehatan Anda dijamin aman oleh teknologi Blockchain. Rasakan pengalaman masa depan dalam rekomendasi pengobatan herbal."
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;