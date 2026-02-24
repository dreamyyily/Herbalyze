import MainLayout from "../../layouts/MainLayout";
import { catatanDokter } from "../../data/catatanDokter";
import { formatTanggal } from "../../utils/formatTanggal";

export default function CatatanDokter() {
  const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
  const role = profile.role || 'Patient';
  const data = catatanDokter; // [] untuk test empty state

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 mt-16">
        <div className="bg-white rounded-3xl shadow-xl p-10 border border-light-40">

          <div className="flex justify-between items-center mb-10">
            <h2 className="text-bold-24 text-dark-50">Catatan Dokter</h2>

            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Pencarian"
                  className="pl-10 pr-4 py-3 rounded-full border border-light-40 focus:outline-none"
                />
              </div>
              
              {/* --- TOMBOL INI HANYA MUNCUL JIKA USER ADALAH DOKTER --- */}
              {role === 'Doctor' && (
                <button className="bg-primary-40 hover:bg-primary-50 text-white px-6 py-3 rounded-full font-semibold transition shadow-md flex items-center gap-2">
                  <span>+</span> Tambah Catatan Baru
                </button>
              )}
            </div>
          </div>

          {/* EMPTY STATE */}
          {data.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24">
              <p className="text-regular-16 text-dark-30">
                Belum ada data dari Catatan Dokter
              </p>
            </div>
          )}

          {/* TABLE */}
          {data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-light-40 text-regular-14 text-dark-30">
                    <th className="py-4">Tanggal</th>
                    <th>Diagnosis Penyakit</th>
                    <th>Dokter</th>
                    <th>Instansi</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-light-30 text-regular-16 text-dark-50"
                    >
                      <td className="py-4">
                        {formatTanggal(item.tanggal)}
                      </td>
                      <td>{item.diagnosis}</td>
                      <td>{item.dokter}</td>
                      <td>{item.instansi}</td>
                      <td>
                        <button className="text-primary-40 font-medium hover:underline">
                          Lihat Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </MainLayout>
  );
}
