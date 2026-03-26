import pandas as pd
from sentence_transformers import SentenceTransformer, InputExample, losses
from torch.utils.data import DataLoader

print("1. Membaca dataset_herbal.csv...")
# Pastikan nama file CSV sesuai dengan yang Anda unduh
df = pd.read_csv("dataset_herbal_masif.csv")
# Siapkan list kosong untuk menampung materi pelajaran
train_examples = []

print("2. Menyusun format pelajaran untuk AI...")
for index, row in df.iterrows():
    # Mengambil kalimat awam dan kata medis dari kolom Excel
    kalimat_awam = f"query: {row['text']}"
    kata_medis = f"query: {row['label']}"
    
    # InputExample memberitahu AI bahwa kedua kalimat ini maknanya 100% SAMA (label=1.0)
    contoh = InputExample(texts=[kalimat_awam, kata_medis], label=1.0)
    train_examples.append(contoh)

# DataLoader bertugas menyuapi AI dengan data sedikit demi sedikit (batch_size=4)
train_dataloader = DataLoader(train_examples, shuffle=True, batch_size=4)

print("3. Memuat model intfloat/multilingual-e5-small...")
model = SentenceTransformer("intfloat/multilingual-e5-small")

# CosineSimilarityLoss adalah 'guru hukuman'. Jika AI memberi skor rendah 
# untuk kalimat yang mirip, nilai loss ini akan menghukum AI agar belajar lebih baik.
train_loss = losses.CosineSimilarityLoss(model)

print("4. MEMULAI PROSES FINE-TUNING! (Mohon tunggu beberapa saat...)")
# Mulai melatih model sebanyak 5 putaran (epochs)
model.fit(
    train_objectives=[(train_dataloader, train_loss)],
    epochs=5,
    warmup_steps=2,
    show_progress_bar=True
)

print("\n5. Pelatihan Selesai! Menyimpan otak baru AI...")
# Menyimpan model ke folder baru di laptop Anda
model.save("./model_herbal_lokal")
print("BERHASIL! Model tersimpan di folder 'model_herbal_lokal'")