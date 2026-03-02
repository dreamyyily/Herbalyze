import { BrowserRouter, Routes, Route, useNavigate, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Home from "./pages/patient/Home.jsx";
import DataPersonal from "./pages/patient/DataPersonal.jsx";
import CatatanDokter from "./pages/patient/CatatanDokter.jsx";
import DaftarDokter from "./pages/patient/DaftarDokter.jsx";
import RekamMedis from "./pages/doctor/RekamMedis.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import Riwayat from "./pages/patient/Riwayat.jsx";
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

// Hanya Dokter
const DoctorOnlyRoute = ({ children }) => {
    const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
    const location = useLocation();
    if (profile.role !== 'Doctor') {
        return <Navigate to="/home" state={{ from: location }} replace />;
    }
    return children;
};

// --- PERBAIKAN LOGIKA AKSES PASIEN ---
// Hanya Pasien (Termasuk yang sedang Pending atau Rejected)
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

// Pasien (Termasuk Pending/Rejected) & Dokter
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
                    navigate('/home');
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
                if (location.pathname !== '/') navigate('/');
            } else {
                localStorage.removeItem('user_wallet');
                localStorage.removeItem('user_profile');
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

            {/* Pasien: lihat daftar dokter & kelola consent */}
            <Route path="/daftar-dokter" element={
                <PatientOnlyRoute><DaftarDokter /></PatientOnlyRoute>
            } />

            {/* Pasien & Dokter: lihat catatan dokter milik wallet sendiri (view-only) */}
            <Route path="/catatan-dokter" element={
                <PatientDoctorRoute><CatatanDokter /></PatientDoctorRoute>
            } />

            {/* Dokter: kelola rekam medis pasien ber-consent */}
            <Route path="/rekam-medis" element={
                <DoctorOnlyRoute><RekamMedis /></DoctorOnlyRoute>
            } />

            <Route path="/admin" element={
                <AdminRoute><AdminDashboard /></AdminRoute>
            } />

            <Route path="/riwayat" element={
                <ProtectedRoute><Riwayat /></ProtectedRoute>
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