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
                if (location.pathname !== '/') navigate('/');
            } else {
                localStorage.removeItem('user_wallet');
                localStorage.removeItem('user_profile');
                localStorage.removeItem('admin_metamask_verified');
                navigate('/');
            }
        });
    }, [navigate, location.pathname]);

    return (
        <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route path="/home" element={
                <ProtectedRoute><Home /></ProtectedRoute>
            } />

            <Route path="/data-personal" element={
                <ProtectedRoute><DataPersonal /></ProtectedRoute>
            } />

            <Route path="/perizinan-dokter" element={
                <PatientDoctorRouteWithAuth><DaftarDokter /></PatientDoctorRouteWithAuth>
            } />

            <Route path="/catatan-dokter" element={
                <PatientDoctorRouteWithAuth><CatatanDokter /></PatientDoctorRouteWithAuth>
            } />

            <Route path="/rekam-medis" element={
                <DoctorOnlyRoute><RekamMedis /></DoctorOnlyRoute>
            } />

            <Route path="/admin" element={
                <AdminRoute><AdminDashboard /></AdminRoute>
            } />

            <Route path="/riwayat" element={
                <ProtectedRoute><Riwayat /></ProtectedRoute>
            } />

            <Route path="/ai-search" element={
                <ProtectedRoute><AiSearch /></ProtectedRoute>
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