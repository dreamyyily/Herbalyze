import { NavLink } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="flex justify-between items-center py-6 px-12 border-b border-light-40 bg-white">
      <div className="text-3xl font-bold text-primary-40">Herbalyze</div>

      <div className="flex gap-12">
        <NavLink to="/" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
          Beranda
        </NavLink>
        <NavLink to="/data-personal" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
          Data Personal
        </NavLink>
        <NavLink to="/catatan-dokter" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
          Catatan Dokter
        </NavLink>
        <NavLink to="/riwayat" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
          Riwayat
        </NavLink>
      </div>

      <div className="flex items-center gap-6">
          <div className="text-regular-16 text-dark-30 font-medium">
             {/* Display Wallet Address (Truncated) or User Initial */}
             {localStorage.getItem('user_wallet') ? 
                localStorage.getItem('user_wallet').substring(0, 6) + '...' + localStorage.getItem('user_wallet').slice(-4) 
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