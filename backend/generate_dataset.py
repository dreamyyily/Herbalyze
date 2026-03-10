import pandas as pd
import random

print("⏳ Memulai pembuatan dataset masif otomatis...")

# 1. Membaca kedua file database Anda
# skiprows=1 untuk melewati baris header pertama
df_gejala = pd.read_csv('datasets/Herbal gejala.csv', usecols=[0], names=['label'], skiprows=1)
df_diag = pd.read_csv('datasets/Herbal diagnosis.csv', usecols=[0], names=['label'], skiprows=1)

# Gabungkan dan bersihkan teks (hapus spasi kosong di awal/akhir kata)
df_all = pd.concat([df_gejala, df_diag]).dropna()
df_all['label'] = df_all['label'].astype(str).str.strip()

# Ambil kata-kata unik saja (menghilangkan duplikat)
unique_labels = df_all['label'].unique()
print(f"✅ Ditemukan {len(unique_labels)} jenis penyakit/gejala unik di database!")

# 2. Template gaya bahasa DOKTER / REKAM MEDIS
templates = [
    "Px mengeluhkan {label} sejak beberapa hari",
    "Terdapat riwayat {label} pada anamnesis pasien",
    "Diagnosis klinis sementara: {label}",
    "Rekomendasi terapi pendamping herbal untuk {label}",
    "Observasi menunjukkan adanya {label}",
    "Indikasi {label}, mohon saran fitofarmaka",
    "Gejala dominan berupa {label}",
    "Pasien didiagnosis dengan {label}"
]

# Kamus khusus: Menggunakan istilah medis/klinis yang sering diketik dokter
kamus_sinonim = {
    "Demam": ["febris", "suhu tubuh > 38C", "hyperthermia", "suhu tubuh meningkat"],
    "Bisul": ["furunkel", "abses di area kulit", "infeksi bakteri staphylococcus di kulit"],
    "Obesitas": ["BMI > 30", "overweight", "sindrom metabolik kegemukan", "indeks massa tubuh tinggi"],
    "Gula darah tinggi": ["hiperglikemia", "diabetes melitus", "kadar glukosa darah puasa tinggi", "DM tipe 2"],
    "Batuk": ["tussis", "batuk produktif", "batuk non-produktif", "infeksi saluran napas atas dengan batuk"],
    "Sakit badan": ["myalgia", "nyeri otot dan sendi seluruh tubuh", "fatigue dan nyeri tubuh"],
    "Nyeri haid": ["dismenore", "nyeri pelvik saat menstruasi", "kram perut bawah saat haid"]
}

dataset = []

# 3. Proses perakitan kalimat
for label in unique_labels:
    # Lewati jika label kosong atau tidak valid
    if len(label) < 2: 
        continue
        
    # Ide Jenius Anda: Menggabungkan Template dengan Sinonim!
    for template in templates:
        # 1. Masukkan kata aslinya dulu (demam)
        kalimat_asli = template.format(label=label.lower())
        dataset.append({"text": kalimat_asli, "label": label})
        
        # 2. Masukkan JUGA sinonimnya ke dalam template (febris, dll)
        for key_sinonim, list_sinonim in kamus_sinonim.items():
            if key_sinonim.lower() == label.lower():
                for sinonim in list_sinonim:
                    kalimat_sinonim = template.format(label=sinonim.lower())
                    dataset.append({"text": kalimat_sinonim, "label": label})

# 4. Simpan ke CSV baru
df_dataset = pd.DataFrame(dataset)

# Acak urutan barisnya agar AI belajarnya merata
df_dataset = df_dataset.sample(frac=1).reset_index(drop=True)

df_dataset.to_csv('dataset_herbal_masif.csv', index=False)
print(f"🎉 SUKSES! File 'dataset_herbal_masif.csv' berhasil dibuat.")
print(f"Total baris data latih: {len(df_dataset)} baris.")