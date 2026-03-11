import Navbar from "../components/Navbar";
import { useState, useEffect } from "react";

export default function MainLayout({ children }) {
  const [showPendingBanner, setShowPendingBanner] = useState(false);

  useEffect(() => {
    const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
    const dismissed = sessionStorage.getItem('dismiss_pending_banner');
    if (profile.role === 'Pending_Doctor' && !dismissed) {
      setShowPendingBanner(true);
    }
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem('dismiss_pending_banner', 'true');
    setShowPendingBanner(false);
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      {showPendingBanner && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-3 flex items-center justify-center">
          <div className="flex items-center gap-3 max-w-4xl w-full">
            <span className="text-yellow-500 text-lg flex-shrink-0">⏳</span>
            <p className="text-yellow-800 text-sm font-medium flex-1">
              <span className="font-bold">Pengajuan Dokter Sedang Diproses — </span>
              Dokumen STR Anda sedang dalam antrean verifikasi Admin. Anda akan mendapat akses dokter setelah disetujui.
            </p>
            <button onClick={handleDismiss} className="text-yellow-500 hover:text-yellow-700 font-bold text-lg flex-shrink-0 transition">
              ✕
            </button>
          </div>
        </div>
      )}

      <main>{children}</main>
    </div>
  );
}