import { NavLink } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import Avatar from "./Avatar";

const API = "http://localhost:8000";

export default function Navbar() {
  const [profileData, setProfileData] = useState({
    name: null, role: 'Patient', foto_profil: null
  });

  useEffect(() => {
    const wallet = localStorage.getItem("user_wallet");
    if (!wallet) return;

    const cached = JSON.parse(localStorage.getItem('user_profile') || '{}');
    if (cached.name || cached.role) {
      setProfileData(prev => ({ ...prev, name: cached.name, role: cached.role || 'Patient', foto_profil: cached.foto_profil || null }));
    }

    fetch(`${API}/api/profile/${wallet}`)
      .then(res => res.json())
      .then(data => {
        setProfileData({ name: data.name || null, role: data.role || 'Patient', foto_profil: data.foto_profil || null });
        localStorage.setItem('user_profile', JSON.stringify({ name: data.name, role: data.role, foto_profil: data.foto_profil || null }));
      })
      .catch(err => console.error("Navbar: gagal load profil", err));
  }, []);

  const { name, role, foto_profil } = profileData;
  const userWallet = (localStorage.getItem('user_wallet') || '').toLowerCase();
  const isPatientMenuVisible = role === 'Patient' || role === 'Pending_Doctor' || role === 'Rejected_Doctor';

  // ── Badge notifikasi draft pending ──
  const [draftCount, setDraftCount] = useState(0);

  const checkPendingDrafts = useCallback(async () => {
    if (!userWallet || role === 'Doctor' || role === 'Admin') return;
    try {
      const res = await fetch(`${API}/api/medical-record/draft/pending/${userWallet}`);
      if (!res.ok) return;
      const data = await res.json();
      setDraftCount(data.count || 0);
    } catch {
      // Silent fail — tidak perlu tampilkan error di navbar
    }
  }, [userWallet, role]);

  useEffect(() => {
    checkPendingDrafts();
    // Polling setiap 30 detik
    const interval = setInterval(checkPendingDrafts, 30000);
    return () => clearInterval(interval);
  }, [checkPendingDrafts]);

  return (
    <nav className="flex justify-between items-center py-6 px-12 border-b border-light-40 bg-white shadow-sm">
      <div className="flex items-center gap-4">
        <div className="text-3xl font-bold text-primary-40">Herbalyze</div>
        {role === 'Doctor' && (
          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
            🩺 Dokter Aktif
          </span>
        )}
        {role === 'Pending_Doctor' && (
          <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">
            ⏳ Menunggu Verifikasi
          </span>
        )}
      </div>

      <div className="flex gap-10">
        {/* Pasien / Pending / Rejected */}
        {isPatientMenuVisible && (
          <>
            <NavLink to="/home" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
              Beranda
            </NavLink>
            <NavLink to="/data-personal" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
              Data Personal
            </NavLink>
            <NavLink to="/daftar-dokter" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
              Daftar Dokter
            </NavLink>
            {/* Catatan Dokter + badge notifikasi */}
            <NavLink to="/catatan-dokter" className={({ isActive }) => `relative text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
              Catatan Dokter
              {draftCount > 0 && (
                <span className="absolute -top-2 -right-4 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm animate-pulse">
                  {draftCount}
                </span>
              )}
            </NavLink>
            <NavLink to="/riwayat" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
              Riwayat
            </NavLink>
          </>
        )}

        {/* Dokter: Home, Data Personal, Daftar Dokter, Catatan Dokter, Rekam Medis, Riwayat */}
        {role === 'Doctor' && (
          <>
            <NavLink to="/home" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
              Beranda
            </NavLink>
            <NavLink to="/data-personal" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
              Data Personal
            </NavLink>
            <NavLink to="/daftar-dokter" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
              Daftar Dokter
            </NavLink>
            <NavLink to="/catatan-dokter" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
              Catatan Dokter
            </NavLink>
            <NavLink to="/rekam-medis" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
              Rekam Medis
            </NavLink>
            <NavLink to="/riwayat" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
              Riwayat
            </NavLink>
          </>
        )}

        {/* Admin */}
        {role === 'Admin' && (
          <NavLink to="/admin" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-purple-600" : "text-dark-30"} hover:text-purple-600 transition`}>
            Dashboard Admin
          </NavLink>
        )}
      </div>

      <div className="flex items-center gap-4">
        <NavLink to="/data-personal" className="group flex items-center gap-3 hover:opacity-90 transition">
          <div className="relative">
            <Avatar name={name} fotoProfil={foto_profil} size="sm" className="border-2 border-primary-30 shadow-sm group-hover:border-primary-50 transition" />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full"></span>
          </div>
          {name && (
            <span className="text-sm font-semibold text-dark-40 group-hover:text-primary-50 transition max-w-[120px] truncate hidden md:block">
              {name.split(" ")[0]}
            </span>
          )}
        </NavLink>

        <button
          onClick={() => {
            localStorage.removeItem('user_wallet');
            localStorage.removeItem('user_profile');
            localStorage.removeItem('admin_metamask_verified');
            window.location.href = '/';
          }}
          className="text-sm font-medium text-danger-30 border border-light-40 hover:bg-danger-10 hover:border-danger-30 px-5 py-2 rounded-full transition-all"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}