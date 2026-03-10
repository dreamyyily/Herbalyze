from sentence_transformers import SentenceTransformer, util

print("⏳ Memuat AI Spesialis Medis (model_herbal_lokal)...")
model = SentenceTransformer("./model_herbal_lokal")

# Kalimat uji coba: Ekstrem klinis dan TIDAK ADA di dataset masif kita!
tests = [
    {"input_dokter": "Px mengeluhkan suhu tubuh naik turun sejak kemarin malam", "target_db": "Demam"},
    {"input_dokter": "terdapat benjolan kemerahan yang terasa nyeri dan berisi cairan pus di area lengan", "target_db": "Bisul"},
    {"input_dokter": "pasien memiliki riwayat tumpukan lemak sentral dengan IMT 32", "target_db": "Obesitas"},
    {"input_dokter": "Px batuk berdahak terus menerus disertai nyeri tenggorokan", "target_db": "Batuk"},
    {"input_dokter": "hasil lab menunjukkan glukosa darah puasa di atas normal", "target_db": "Gula darah tinggi"}
]

print("\n🎯 HASIL UJIAN SIDANG AI (Uji Kalimat Baru)")
print("-" * 75)

for t in tests:
    # Ubah teks jadi koordinat angka (vektor embedding)
    v_input = model.encode(f"query: {t['input_dokter']}")
    v_target = model.encode(f"query: {t['target_db']}")
    
    # Hitung jarak kedekatan koordinat (Cosine Similarity)
    score = util.cos_sim(v_input, v_target)[0][0].item() * 100
    print(f"[{t['input_dokter']}]")
    print(f"   -> Menebak diagnosis: [{t['target_db']}] -> KEYAKINAN: {score:.2f}%\n")

print("-" * 75)