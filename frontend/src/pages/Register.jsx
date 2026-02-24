
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
            alert("Passwords do not match!");
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
            if (!response.ok) throw new Error(data.error || 'Registration failed');

            // Success, move to Step 2 (Connect Wallet)
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
            // Step 1: Connect wallet and get address
            const address = await connectWallet();
            
            // Step 2: Link wallet to account (No signature needed for linking)
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
                throw new Error(data.error || 'Failed to link wallet');
            }

            // Success! Save session and go home
            localStorage.setItem('user_wallet', address);
            localStorage.setItem('user_profile', JSON.stringify(data.user));

            navigate('/home');

        } catch (error) {
            console.error("Wallet Linking Error:", error);
            alert("Failed to link wallet: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col md:flex-row font-sans">
            {/* Left Side: Form */}
            <div className="w-full md:w-1/2 flex flex-col justify-center items-center p-8 bg-white relative z-10">
                <div className="max-w-md w-full">
                    {step === 1 ? (
                        // STEP 1: REGISTRATION FORM
                        <div className="bg-white p-8 rounded-2xl shadow-xl">
                            <div className="text-center mb-8">
                                <h1 className="text-4xl font-extrabold text-primary-40 tracking-tight">Herbalyze</h1>
                                <h2 className="text-3xl font-bold text-gray-900 mt-2">Create Account</h2>
                                <p className="text-gray-500 mt-2">Join Herbalyze as a Patient</p>
                            </div>

                            <form className="space-y-6" onSubmit={handleRegister}>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Full Name</label>
                                    <input 
                                        name="name" 
                                        type="text" 
                                        required 
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-40 focus:border-primary-40 sm:text-sm"
                                        value={formData.name}
                                        onChange={handleChange}
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Email Address</label>
                                    <input 
                                        name="email" 
                                        type="email" 
                                        required 
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-40 focus:border-primary-40 sm:text-sm"
                                        value={formData.email}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Password</label>
                                    <input 
                                        name="password" 
                                        type="password" 
                                        required 
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-40 focus:border-primary-40 sm:text-sm"
                                        value={formData.password}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                                    <input 
                                        name="confirmPassword" 
                                        type="password" 
                                        required 
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-40 focus:border-primary-40 sm:text-sm"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Role</label>
                                    <select disabled className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm sm:text-sm text-gray-500">
                                        <option>Patient (Default)</option>
                                    </select>
                                </div>

                                <button 
                                    type="submit" 
                                    disabled={isLoading}
                                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-40 hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-40 transition-all"
                                >
                                    {isLoading ? 'Processing...' : 'Register'}
                                </button>
                            </form>
                            <div className="text-center mt-4">
                                <span onClick={() => navigate('/')} className="text-primary-40 cursor-pointer hover:underline">
                                    Already have an account? Login
                                </span>
                            </div>
                        </div>
                    ) : (
                        // STEP 2: LINK WALLET
                        <div className="bg-white p-8 rounded-2xl shadow-xl text-center">
                            <div className="mb-6 flex justify-center">
                                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center animate-bounce">
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" alt="MetaMask" className="w-12 h-12" />
                                </div>
                            </div>
                            
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Your Wallet</h2>
                            <p className="text-gray-500 mb-8">
                                Final step! Link your MetaMask wallet to secure your identity on the blockchain.
                            </p>

                            <button 
                                onClick={handleLinkWallet}
                                disabled={isLoading}
                                className="w-full flex justify-center items-center gap-3 py-3 px-6 border border-gray-300 rounded-xl text-gray-800 bg-white hover:bg-gray-50 shadow-md transform transition hover:scale-105"
                            >
                                <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" alt="MetaMask" className="w-6 h-6" />
                                <span className="font-bold">Link MetaMask</span>
                            </button>
                        </div>
                    )}
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

export default Register;
