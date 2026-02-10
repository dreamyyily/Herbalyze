import { NavLink } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="flex justify-between items-center py-6 px-12 border-b border-light-40 bg-white">
      <div className="text-3xl font-bold text-primary-40">Herbalyze</div>

      <div className="flex gap-12">
        <NavLink to="/" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
          Beranda
        </NavLink>
        <NavLink to="/personal" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
          Data Personal
        </NavLink>
        <NavLink to="/catatan" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
          Catatan Dokter
        </NavLink>
        <NavLink to="/riwayat" className={({ isActive }) => `text-regular-16 ${isActive ? "text-bold-16 text-primary-40" : "text-dark-30"} hover:text-primary-40 transition`}>
          Riwayat
        </NavLink>
      </div>

      <div className="text-regular-16 text-dark-30">LP</div>
    </nav>
  );
}