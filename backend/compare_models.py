from sentence_transformers import SentenceTransformer, util

print("⏳ Memuat Model Bawaan Pabrik (Base)...")
model_base = SentenceTransformer('intfloat/multilingual-e5-small')

print("⏳ Memuat Model Hasil Pelatihan (Lokal)...")
model_ft = SentenceTransformer('./model_herbal_lokal')

# Daftar label penyakit baku di database kita
labels = ["Demam", "Bisul", "Obesitas", "Batuk", "Gula darah tinggi", "Asam Urat"]

# Keluhan dokter yang tidak baku (Ujian untuk AI)
queries = [
    "badan panas",
    "berat badan berlebohan",
    "bentolan bernanah di kaki"
]

print("\n" + "="*70)
print("🥊 UJIAN HEAD-TO-HEAD: PENCARIAN PENYAKIT (PABRIK VS LOKAL) 🥊")
print("="*70)

for q in queries:
    print(f"\n🩺 KELUHAN PASIEN: '{q}'")
    
    # --- PROSES MODEL PABRIK ---
    vec_q_base = model_base.encode(f"query: {q}")
    vec_labels_base = model_base.encode([f"query: {l}" for l in labels])
    scores_base = util.cos_sim(vec_q_base, vec_labels_base)[0]
    
    # --- PROSES MODEL LOKAL ---
    vec_q_ft = model_ft.encode(f"query: {q}")
    vec_labels_ft = model_ft.encode([f"query: {l}" for l in labels])
    scores_ft = util.cos_sim(vec_q_ft, vec_labels_ft)[0]
    
    print("-" * 70)
    print(f"{'DIAGNOSIS BAKU':<20} | {'SKOR MODEL PABRIK':<20} | {'SKOR MODEL LOKAL (FT)':<20}")
    print("-" * 70)
    
    for i, l in enumerate(labels):
        skor_base_pct = scores_base[i].item() * 100
        skor_ft_pct = scores_ft[i].item() * 100
        
        # Beri tanda bintang jika skornya paling tinggi (tebakan AI)
        tanda_base = "⭐" if skor_base_pct == max([s.item()*100 for s in scores_base]) else "  "
        tanda_ft = "⭐" if skor_ft_pct == max([s.item()*100 for s in scores_ft]) else "  "
        
        print(f"{l:<20} | {tanda_base} {skor_base_pct:>6.2f}%            | {tanda_ft} {skor_ft_pct:>6.2f}%")

print("="*70)