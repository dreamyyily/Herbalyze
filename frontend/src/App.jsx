import { BrowserRouter, Routes, Route, useNavigate, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Home from "./pages/patient/Home.jsx";
import DataPersonal from "./pages/patient/DataPersonal.jsx";
import CatatanDokter from "./pages/patient/CatatanDokter.jsx";
import DaftarDokter from "./pages/patient/PerizinanDokter.jsx";
import RekamMedis from "./pages/doctor/RekamMedis.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import Riwayat from "./pages/patient/Riwayat.jsx";
import AiSearch from "./pages/patient/AiSearch.jsx";
import { checkWalletConnection, listenToAccountChanges } from "./utils/web3Helpers";

const ProtectedRoute = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(null);
    const location = useLocation();

    useEffect(() => {
        const checkAuth = async () => {
            const address = await checkWalletConnection();
            setIsAuthenticated(!!address);
        };
        checkAuth();
    }, []);

    if (isAuthenticated === null) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }
    if (!isAuthenticated) {
        return <Navigate to="/" state={{ from: location }} replace />;
    }
    return children;
};

const AdminRoute = ({ children }) => {
    const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
    const location = useLocation();
    if (profile.role !== 'Admin') {
        return <Navigate to="/" state={{ from: location }} replace />;
    }
    return children;
};

const DoctorOnlyRoute = ({ children }) => {
    const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
    const location = useLocation();
    if (profile.role !== 'Doctor') {
        return <Navigate to="/home" state={{ from: location }} replace />;
    }
    return children;
};

const PatientOnlyRoute = ({ children }) => {
    const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
    const location = useLocation();
    
    const isPatientGroup = 
        profile.role === 'Patient' || 
        profile.role === 'Pending_Doctor' || 
        profile.role === 'Rejected_Doctor';

    if (!isPatientGroup) {
        return <Navigate to="/home" state={{ from: location }} replace />;
    }
    return children;
};

// Route yang butuh login tapi TIDAK perlu profil lengkap (hanya cek role)
const PatientDoctorRouteWithAuth = ({ children }) => {
    const location = useLocation();
    const [roleStatus, setRoleStatus] = useState(null); // null=loading, true=ok, false=rejected

    useEffect(() => {
        const wallet = localStorage.getItem('user_wallet');
        if (!wallet) {
            setRoleStatus(false);
            return;
        }
        // Cek dari localStorage dulu (cepat)
        const cached = JSON.parse(localStorage.getItem('user_profile') || '{}');
        const validRoles = ['Patient', 'Doctor', 'Pending_Doctor', 'Rejected_Doctor'];
        if (cached.role && validRoles.includes(cached.role)) {
            setRoleStatus(true);
            return;
        }
        // Jika belum ada di cache, fetch dari API
        fetch(`http://localhost:8000/api/profile/${wallet}`)
            .then(res => res.json())
            .then(data => {
                if (data.role) {
                    localStorage.setItem('user_profile', JSON.stringify({ ...cached, role: data.role, name: data.name, foto_profil: data.foto_profil || null }));
                }
                const ok = validRoles.includes(data.role);
                setRoleStatus(ok);
            })
            .catch(() => setRoleStatus(false));
    }, []);

    if (roleStatus === null) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }
    if (!roleStatus) {
        return <Navigate to="/" state={{ from: location }} replace />;
    }
    return children;
};

const PatientDoctorRoute = ({ children }) => {
    const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
    const location = useLocation();

    const isPatientDoctorGroup = 
        profile.role === 'Patient' || 
        profile.role === 'Doctor' ||
        profile.role === 'Pending_Doctor' || 
        profile.role === 'Rejected_Doctor';

    if (!isPatientDoctorGroup) {
        return <Navigate to="/home" state={{ from: location }} replace />;
    }
    return children;
};

// Tambahkan komponen ini di App.jsx, setelah PatientDoctorRoute

const ProfileCompleteRoute = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [status, setStatus] = useState(null);

    useEffect(() => {
        const checkProfile = async () => {
            const wallet = localStorage.getItem('user_wallet');
            if (!wallet) { setStatus(false); return; }

            const cached = JSON.parse(localStorage.getItem('user_profile_complete') || 'null');
            if (cached === true) { setStatus(true); return; }

            try {
                const res = await fetch(`http://localhost:8000/api/profile/${wallet}`);
                if (!res.ok) { setStatus(false); return; }
                const profile = await res.json();

                const isComplete = !!(
                    profile.nik &&
                    profile.name &&
                    profile.tanggal_lahir &&
                    profile.alergi_herbal &&
                    profile.alergi_herbal.length > 0
                );

                localStorage.setItem('user_profile_complete', JSON.stringify(isComplete));
                setStatus(isComplete);
            } catch {
                setStatus(false);
            }
        };
        checkProfile();
    }, [location.pathname]);

    if (status === null) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }

    // ✅ Bukan redirect, tapi render halaman + overlay di atasnya
    return (
        <div className="relative">
            {/* Halaman asli tetap dirender di belakang */}
            {children}

            {/* Overlay muncul hanya jika profil belum lengkap */}
            {!status && (
                <div className="fixed inset-0 z-[9999] bg-white/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white p-8 rounded-[2rem] shadow-2xl border border-gray-100 text-center max-w-md w-full animate-fade-in">
                        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 border-[8px] border-amber-50/50">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800 mb-3">
                            Halaman Terkunci
                        </h3>
                        <p className="text-sm text-gray-500 mb-2 leading-relaxed px-2">
                            Untuk mengakses halaman ini, kamu perlu melengkapi <strong>Data Personal</strong> terlebih dahulu.
                        </p>
                        <p className="text-xs text-gray-400 mb-8 leading-relaxed px-2">
                            Data ini dibutuhkan agar sistem dapat memberikan rekomendasi yang aman dan sesuai kondisi kesehatanmu.
                        </p>
                        <button
                            onClick={() => navigate("/data-personal", { state: { fromProfileIncomplete: true } })}
                            className="w-full bg-primary-50 text-white font-bold py-4 rounded-xl hover:bg-primary-60 shadow-lg shadow-primary-50/30 transition-all active:scale-95"
                        >
                            Lengkapi Data Personal
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const AppContent = () => {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const checkAutoLogin = async () => {
            if (location.pathname === '/') {
                const address = await checkWalletConnection();
                const storedWallet = localStorage.getItem('user_wallet');
                if (address && storedWallet && address.toLowerCase() === storedWallet.toLowerCase()) {
                    const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
                    const adminVerified = localStorage.getItem('admin_metamask_verified') === 'true';
                    if (profile.role === 'Admin' && adminVerified) {
                        navigate('/admin');
                    } else if (profile.role !== 'Admin') {
                        navigate('/home');
                    }
                    // Jika Admin tapi belum verify MetaMask → tetap di halaman login
                }
            }
        };
        checkAutoLogin();
    }, [location.pathname, navigate]);

    useEffect(() => {
        listenToAccountChanges((newAccount) => {
            if (!newAccount) {
                localStorage.removeItem('user_wallet');
                localStorage.removeItem('user_profile');
                localStorage.removeItem('admin_metamask_verified');
                localStorage.removeItem('user_profile_complete');
                if (location.pathname !== '/') navigate('/');
            } else {
                localStorage.removeItem('user_wallet');
                localStorage.removeItem('user_profile');
                localStorage.removeItem('admin_metamask_verified');
                localStorage.removeItem('user_profile_complete');
                navigate('/');
            }
        });
    }, [navigate, location.pathname]);

    return (
        <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route path="/home" element={
                <ProtectedRoute><ProfileCompleteRoute>
                    <Home />
                </ProfileCompleteRoute></ProtectedRoute>
            } />

            <Route path="/data-personal" element={
                <ProtectedRoute><DataPersonal /></ProtectedRoute>
            } />

            <Route path="/perizinan-dokter" element={
                <PatientDoctorRouteWithAuth><ProfileCompleteRoute>
                    <DaftarDokter />
                </ProfileCompleteRoute></PatientDoctorRouteWithAuth>
            } />

            <Route path="/catatan-dokter" element={
                <PatientDoctorRouteWithAuth><ProfileCompleteRoute>
                    <CatatanDokter />
                </ProfileCompleteRoute></PatientDoctorRouteWithAuth>
            } />

            <Route path="/rekam-medis" element={
                <DoctorOnlyRoute><ProfileCompleteRoute>
                    <RekamMedis />
                </ProfileCompleteRoute></DoctorOnlyRoute>
            } />

            <Route path="/admin" element={
                <AdminRoute><AdminDashboard /></AdminRoute>
            } />

            <Route path="/riwayat" element={
                <ProtectedRoute><ProfileCompleteRoute>
                    <Riwayat />
                </ProfileCompleteRoute></ProtectedRoute>
            } />

            <Route path="/ai-search" element={
                <ProtectedRoute><ProfileCompleteRoute>
                    <AiSearch />
                </ProfileCompleteRoute></ProtectedRoute>
            } />
            
        </Routes>
    );
};

export default function App() {
    return (
        <BrowserRouter>
            <AppContent />
        </BrowserRouter>
    );
}