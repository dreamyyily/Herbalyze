
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { connectWallet, signMessage, generateAuthMessage } from '../utils/web3Helpers'; 

const Login = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [loginData, setLoginData] = useState({ email: '', password: '' });
    const navigate = useNavigate();

    const handleChange = (e) => {
        setLoginData({ ...loginData, [e.target.name]: e.target.value });
    };

    // 1. Traditional Login (Email/Password)
    const handleEmailLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const response = await fetch('http://localhost:5000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginData)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Login failed');
            
            // Save basic session
            if (data.user.wallet_address) {
                localStorage.setItem('user_wallet', data.user.wallet_address);
            } else {
                 // Use placeholder or just user profile if no wallet yet
                 localStorage.setItem('user_profile', JSON.stringify(data.user));
            }
            navigate('/home');

        } catch (error) {
            alert(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // 2. MetaMask Login (Signature-based, FREE - no gas fee)
    const handleConnectMetaMask = async () => {
        setIsLoading(true);
        try {
            // Step 1: Connect wallet and get address
            const address = await connectWallet();
            
            // Step 2: Generate authentication message
            const message = generateAuthMessage(address);
            
            // Step 3: Sign message (FREE - no gas fee, just signature)
            const signedData = await signMessage(message);
            
            // Step 4: Send to backend for verification
            const response = await fetch('http://localhost:5000/api/login-wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: signedData.address,
                    signature: signedData.signature,
                    message: signedData.message
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // Step 5: Save session and navigate
            localStorage.setItem('user_wallet', signedData.address);
            if (data.user) {
                localStorage.setItem('user_profile', JSON.stringify(data.user));
            }

            navigate('/home');

        } catch (error) {
            console.error("MetaMask Login Error:", error);
            alert("Login failed: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col md:flex-row font-sans">
            {/* Left Side: Interaction */}
            <div className="w-full md:w-1/2 flex flex-col justify-center items-center p-8 bg-white relative z-10">
                <div className="max-w-md w-full space-y-8">
                    <div className="text-center">
                        <h1 className="text-4xl font-extrabold text-primary-40 tracking-tight">Herbalyze</h1>
                        <p className="mt-2 text-sm text-gray-500">Welcome back! Please login to your account.</p>
                    </div>

                    <form className="mt-8 space-y-6" onSubmit={handleEmailLogin}>
                        <div className="rounded-md shadow-sm -space-y-px">
                            <div>
                                <label htmlFor="email-address" className="sr-only">Email address</label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    required
                                    className="appearance-none rounded-t-md relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-40 focus:border-primary-40 focus:z-10 sm:text-sm"
                                    placeholder="Email address"
                                    value={loginData.email}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label htmlFor="password" className="sr-only">Password</label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    className="appearance-none rounded-b-md relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-40 focus:border-primary-40 focus:z-10 sm:text-sm"
                                    placeholder="Password"
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
                                Sign in
                            </button>
                        </div>
                    </form>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500">Or continue with Blockchain</span>
                        </div>
                    </div>

                    <button
                        onClick={handleConnectMetaMask}
                        disabled={isLoading}
                        className="w-full flex justify-center items-center gap-3 py-3 px-6 border border-gray-300 rounded-xl text-gray-700 bg-white hover:bg-gray-50 shadow-sm transform transition hover:scale-[1.01]"
                    >
                         <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" alt="MetaMask" className="w-6 h-6" />
                        <span className="font-semibold">Login with MetaMask</span>
                    </button>

                    <div className="text-center mt-4">
                        <p className="text-sm text-gray-600">
                            Don't have an account?{' '}
                            <span 
                                onClick={() => navigate('/register')} 
                                className="font-medium text-primary-40 hover:text-primary-50 cursor-pointer"
                            >
                                Register here
                            </span>
                        </p>
                    </div>
                </div>
            </div>

             {/* Right Side: Visuals */}
             <div className="hidden md:flex md:w-1/2 bg-gradient-to-b from-green-200 via-green-400 to-green-800 relative overflow-hidden flex-col justify-center items-center">
                <div className="relative z-10 text-center max-w-lg px-8">
                     <div className="mb-8 transform hover:scale-105 transition duration-500">
                        <div className="w-40 h-40 bg-white/30 backdrop-blur-md rounded-full mx-auto flex items-center justify-center shadow-2xl border border-white/40">
                             <span className="text-6xl filter drop-shadow-lg">🌿</span>
                        </div>
                     </div>
                    <h2 className="text-4xl font-extrabold text-white mb-4 drop-shadow-lg">Nature Meets Technology</h2>
                    <p className="text-white text-lg font-medium bg-white/20 p-4 rounded-xl backdrop-blur-sm shadow-lg">
                        "Your health data, secured by blockchain technology. Experience the future of herbal medicine recommendations."
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
