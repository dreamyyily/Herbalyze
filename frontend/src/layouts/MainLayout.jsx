import Navbar from "../components/Navbar";
import { useState, useEffect } from "react";
import { Clock, X } from "lucide-react";

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
        <div className="bg-amber-50 border-b-2 border-amber-200 shadow-sm">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-4">
            
            <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
              <Clock size={15} className="text-amber-600" />
            </div>

            <p className="text-amber-800 text-sm flex-1">
              <span className="font-bold">Pengajuan Dokter Sedang Diproses — </span>
              Dokumen STR Anda sedang dalam antrean verifikasi Admin. Anda akan mendapat akses dokter setelah disetujui.
            </p>

            <button
              onClick={handleDismiss}
              className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-100 hover:bg-amber-200 flex items-center justify-center transition"
            >
              <X size={13} className="text-amber-600" />
            </button>

          </div>
        </div>
      )}

      <main>{children}</main>
    </div>
  );
}