
import { BrowserRouter, Routes, Route, useNavigate, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Home from "./pages/general/Home.jsx";
import DataPersonal from "./pages/general/DataPersonal.jsx";
import CatatanDokter from "./pages/patient/CatatanDokter.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import Riwayat from "./pages/general/Riwayat.jsx";
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

const DoctorRoute = ({ children }) => {
    const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
    const location = useLocation();
    
    if (profile.role !== 'Doctor' && profile.role !== 'Patient' && profile.role !== 'Pending_Doctor') {
        return <Navigate to="/home" state={{ from: location }} replace />;
    }

    return children;
};

const AppContent = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Auto-Login Check (User Request: "Di App.jsx... detect wallet... redirect to home")
    useEffect(() => {
        const checkAutoLogin = async () => {
            if (location.pathname === '/') {
                const address = await checkWalletConnection();
                const storedWallet = localStorage.getItem('user_wallet');
                
                if (address && storedWallet && address.toLowerCase() === storedWallet.toLowerCase()) {
                    console.log("Auto-login: Wallet connected, redirecting to Home.");
                    navigate('/home');
                }
            }
        };
        checkAutoLogin();
    }, [location.pathname, navigate]);

    // Account Change Listener
    useEffect(() => {
        listenToAccountChanges((newAccount) => {
            if (!newAccount) {
                 // Disconnected
                 localStorage.removeItem('user_wallet');
                 localStorage.removeItem('user_profile');
                 if (location.pathname !== '/') navigate('/'); 
            } else {
                 // Changed Account -> Force Logout (Security: "hapus sesi dan paksa logout")
                 console.log("Wallet changed, logging out security.");
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
                <ProtectedRoute>
                    <Home />
                </ProtectedRoute>
            } />
            <Route path="/data-personal" element={
                <ProtectedRoute>
                    <DataPersonal />
                </ProtectedRoute>
            } />
            <Route path="/catatan-dokter" element={
                <DoctorRoute>
                    <CatatanDokter />
              </DoctorRoute>
            } />
            <Route path="/admin" element={
                <AdminRoute>
                    <AdminDashboard />
                </AdminRoute>
            } />
            <Route path="/riwayat" element={
                <ProtectedRoute>
                    <Riwayat />
                </ProtectedRoute>
            } />
            <Route path="/riwayat" element={
                <ProtectedRoute>
                    <Riwayat />
                </ProtectedRoute>
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