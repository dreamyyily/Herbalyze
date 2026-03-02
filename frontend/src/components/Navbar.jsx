import { NavLink } from "react-router-dom";

export default function Navbar() {
  const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
  const role = profile.role || 'Patient';

  return (
    <nav className="flex justify-between items-center py-6 px-12 border-b border-light-40 bg-white shadow-sm">
      <div className="flex items-center gap-4">
        <div className="text-3xl font-bold text-primary-40">Herbalyze</div>
        {role === 'Doctor' && (
          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
            🩺 Dokter Aktif
          </span>
        )}
        {role === 'Admin' && (
          <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
            👑 Administrator
          </span>
        )}
      </div>

      <div className="flex gap-10">
        {/* Pasien: Home, Data Personal, Daftar Dokter, Catatan Dokter, Riwayat */}
        {role === 'Patient' && (
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
            <NavLink to="/riwayat" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
              Riwayat
            </NavLink>
          </>
        )}

        {/* Dokter: Home, Data Personal, Catatan Dokter, Rekam Medis, Riwayat */}
        {role === 'Doctor' && (
          <>
            <NavLink to="/home" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
              Beranda
            </NavLink>
            <NavLink to="/data-personal" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
              Data Personal
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

      <div className="flex items-center gap-6">
        <div className="text-regular-16 text-dark-30 font-medium bg-gray-100 px-4 py-1.5 rounded-full">
          {profile.name
            ? profile.name
            : localStorage.getItem('user_wallet')
              ? localStorage.getItem('user_wallet').substring(0, 6) + '...' + localStorage.getItem('user_wallet').slice(-4)
              : 'User'}
        </div>
        <button
          onClick={() => {
            localStorage.removeItem('user_wallet');
            localStorage.removeItem('user_profile');
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