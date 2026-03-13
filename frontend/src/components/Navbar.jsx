import { NavLink } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import Avatar from "./Avatar";
import { LogOut, Trash2, TriangleAlert } from "lucide-react";

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
        window.dispatchEvent(new Event('profile-updated'));
      })
      .catch(err => console.error("Navbar: gagal load profil", err));
  }, []);

  const { name, role, foto_profil } = profileData;
  const userWallet = (localStorage.getItem('user_wallet') || '').toLowerCase();
  const isPatientMenuVisible = role === 'Patient' || role === 'Pending_Doctor' || role === 'Rejected_Doctor';

  const [draftCount, setDraftCount] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

const handleLogout = () => {
  localStorage.removeItem('user_wallet');
  localStorage.removeItem('user_profile');
  localStorage.removeItem('admin_metamask_verified');
  sessionStorage.removeItem('dismiss_pending_banner');
  window.location.href = '/';
};

const handleDeleteAccount = async () => {
  const wallet = localStorage.getItem("user_wallet");
  if (!wallet) return;
  setIsDeleting(true);
  try {
    const res = await fetch(`${API}/api/account/delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet_address: wallet }),
    });
    if (!res.ok) throw new Error("Gagal menghapus akun");
    localStorage.removeItem('user_wallet');
    localStorage.removeItem('user_profile');
    localStorage.removeItem('admin_metamask_verified');
    sessionStorage.removeItem('dismiss_pending_banner');
    window.location.href = '/';
  } catch (err) {
    alert("Gagal menghapus akun: " + err.message);
  } finally {
    setIsDeleting(false);
  }
};

  const checkPendingDrafts = useCallback(async () => {
    if (!userWallet || role === 'Admin') return;
    try {
      const res = await fetch(`${API}/api/medical-record/draft/pending/${userWallet}`);
      if (!res.ok) return;
      const data = await res.json();
      setDraftCount(data.count || 0);
    } catch {
      // Silent fail 
    }
  }, [userWallet, role]);

  useEffect(() => {
    checkPendingDrafts();
    const interval = setInterval(checkPendingDrafts, 30000);
    return () => clearInterval(interval);
  }, [checkPendingDrafts]);

  return (
  <>
    <nav className="flex justify-between items-center py-6 px-12 border-b border-light-40 bg-white shadow-sm">
      <div className="flex items-center gap-4">
        <div className="text-3xl font-bold text-primary-40">Herbalyze</div>
        {role === 'Doctor' && (
          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
            🩺 Dokter Aktif
          </span>
        )}
      </div>

      <div className="flex gap-10">
        {isPatientMenuVisible && (
          <>
            <NavLink to="/home" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
              Beranda
            </NavLink>
            <NavLink to="/data-personal" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
              Data Personal
            </NavLink>
            <NavLink to="/perizinan-dokter" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
              Perizinan Dokter
            </NavLink>
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

        {role === 'Doctor' && (
          <>
            <NavLink to="/home" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
              Beranda
            </NavLink>
            <NavLink to="/data-personal" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
              Data Personal
            </NavLink>
            <NavLink to="/perizinan-dokter" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
              Perizinan Dokter
            </NavLink>
            <NavLink to="/catatan-dokter" className={({ isActive }) => `relative text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
              Catatan Dokter
              {draftCount > 0 && (
                <span className="absolute -top-2 -right-4 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm animate-pulse">
                  {draftCount}
                </span>
              )}
            </NavLink>
            <NavLink to="/rekam-medis" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
              Rekam Medis
            </NavLink>
            <NavLink to="/riwayat" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
              Riwayat
            </NavLink>
          </>
        )}

        {role === 'Admin' && (
          <NavLink to="/admin" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-purple-600" : "text-dark-30"} hover:text-purple-600 transition`}>
            Dashboard Admin
          </NavLink>
        )}
      </div>

      {/* Avatar + Dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(prev => !prev)}
          className="group flex items-center gap-3 hover:opacity-90 transition"
        >
          <div className="relative">
            <Avatar name={name} fotoProfil={foto_profil} size="sm" className="border-2 border-primary-30 shadow-sm group-hover:border-primary-50 transition" />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full"></span>
          </div>
          {name && (
            <span className="text-sm font-semibold text-dark-40 group-hover:text-primary-50 transition max-w-[120px] truncate hidden md:block">
              {name.split(" ")[0]}
            </span>
          )}
        </button>

        {isDropdownOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
            <div className="absolute right-0 mt-3 w-60 bg-white rounded-2xl shadow-xl border border-light-40 z-20 overflow-hidden">
              <NavLink
                  to="/data-personal"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-light-20 transition"
                >
                  <Avatar name={name} fotoProfil={foto_profil} size="xs" className="border border-light-40 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-dark-50 truncate">{name || "Pengguna"}</p>
                    <p className="text-xs text-dark-30">Lihat profil →</p>
                  </div>
                </NavLink>

                <div className="border-t border-light-40 grid grid-cols-2">
                  <button
                    onClick={() => { setIsDropdownOpen(false); setIsDeleteModalOpen(true); }}
                    className="flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-medium text-danger-30 hover:bg-red-50 transition border-r border-light-40"
                  >
                    <Trash2 size={13} /> Hapus Akun
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-medium text-dark-40 hover:bg-light-20 transition"
                  >
                    <LogOut size={13} /> Logout
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </nav>

    {/* Modal Hapus Akun */}
    {isDeleteModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Trash2 size={28} className="text-danger-30" />
          </div>

          <h3 className="text-xl font-extrabold text-dark-50 mb-2">Hapus Akun Permanen?</h3>
          <p className="text-dark-30 text-sm leading-relaxed mb-4">
            Seluruh data profil Anda akan dihapus secara permanen dan tidak dapat dipulihkan.
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 text-left">
            <p className="text-yellow-800 text-xs font-bold mb-1 flex items-center gap-1"><TriangleAlert size={12} /> Perhatian</p>
            <p className="text-yellow-700 text-xs leading-relaxed">
              Rekam medis yang sudah tersimpan di blockchain bersifat <strong>permanen</strong> dan tidak dapat dihapus oleh siapapun, termasuk oleh sistem kami.
            </p>
          </div>

          <p className="text-dark-40 text-sm mb-2">Ketik <strong>HAPUS</strong> untuk mengkonfirmasi</p>
          <input
            type="text"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="Ketik HAPUS"
            className="w-full border border-light-40 rounded-xl px-4 py-3 text-sm text-center focus:outline-none focus:border-danger-30 focus:ring-2 focus:ring-red-100 mb-6"
          />

          <div className="flex gap-3">
            <button
              onClick={() => { setIsDeleteModalOpen(false); setDeleteConfirm(""); }}
              className="flex-1 px-6 py-3 rounded-xl bg-light-20 hover:bg-light-40 text-dark-50 font-bold transition"
            >
              Batal
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={deleteConfirm !== "HAPUS" || isDeleting}
              className={`flex-1 px-6 py-3 rounded-xl font-bold text-white transition ${
                deleteConfirm === "HAPUS" && !isDeleting
                  ? "bg-danger-30 hover:bg-red-600"
                  : "bg-light-50 cursor-not-allowed"
              }`}
            >
              {isDeleting ? "Menghapus..." : "Hapus Akun"}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
);
}