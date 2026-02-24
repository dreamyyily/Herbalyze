import json  # <--- DITAMBAHKAN: Untuk memproses data JSON sebelum masuk database
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from db import get_connection

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/diagnoses")
def get_diagnoses():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT diagnosis FROM herbal_diagnoses ORDER BY diagnosis;")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return sorted(set(row[0].strip() for row in rows if row[0]))

@app.get("/api/symptoms")
def get_symptoms():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT symptom FROM herbal_symptoms ORDER BY symptom;")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return sorted(set(row[0].strip() for row in rows if row[0]))

@app.get("/api/herbs")
def get_herbs():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT herbal_name FROM herbal_diagnoses UNION SELECT herbal_name FROM herbal_symptoms;")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    result = []
    for row in rows:
        if row[0]:
            names = [n.strip() for n in row[0].split("\n") if n.strip()]
            if len(names) > 1:
                main_name = names[0]
                aliases = ", ".join(names[1:])
                label = f"{main_name} ({aliases})"
            else:
                label = names[0]
            result.append(label)
    return sorted(result)

# =========================================================
# FUNGSI REKOMENDASI & PENCATATAN RIWAYAT
# =========================================================
@app.post("/api/recommend")
async def recommend_herbal(request: Request):
    try:
        data = await request.json()
        
        # Mengambil identitas & input pasien
        wallet_addr = data.get('wallet_address', 'guest_user') # <--- DITAMBAHKAN: Tangkap Wallet
        sel_diag = data.get('diagnosis', [])
        sel_symp = data.get('gejala', [])
        raw_cond = data.get('kondisi', [])
        obat_kimia = data.get('obat_kimia', [])                # <--- DITAMBAHKAN: Tangkap Obat Kimia

        # ---------------------------------------------------------
        # KAMUS PENERJEMAH (RULE-BASED MAPPING)
        # ---------------------------------------------------------
        condition_mapping = {
            "Ibu hamil": "hamil",
            "Ibu menyusui": "menyusui",
            "Anak di bawah lima tahun": "anak di bawah 5 tahun"
        }

        sel_cond = []
        for c in raw_cond:
            if c in condition_mapping:
                sel_cond.append(condition_mapping[c])
            elif c != "Tidak ada":
                sel_cond.append(c)

        conn = get_connection()
        cur = conn.cursor()

        # Helper 1: Saring Herbal yang Dilarang
        def get_safe_herbs(herb_names, conditions):
            if not herb_names: return []
            if not conditions: return list(herb_names)
            
            cur.execute("""
                SELECT herbal_name FROM herbal_special_conditions 
                WHERE herbal_name = ANY(%s) AND special_condition = ANY(%s)
            """, (list(herb_names), conditions))
            unsafe = {row[0] for row in cur.fetchall() if row[0]}
            
            return [h for h in herb_names if h not in unsafe]

        # Helper 2: Ambil Detail Lengkap dengan UNION
        def get_details(herb_names):
            if not herb_names: return []
            cur.execute("""
                SELECT herbal_name, latin_name, image_url, preparation, part_used, part_image_url, source_label, source
                FROM herbal_diagnoses WHERE herbal_name = ANY(%s)
                UNION
                SELECT herbal_name, latin_name, image_url, preparation, part_used, part_image_url, source_label, source
                FROM herbal_symptoms WHERE herbal_name = ANY(%s)
            """, (list(herb_names), list(herb_names)))
            
            rows = cur.fetchall()
            res = []
            seen = set()
            for r in rows:
                h_name = r[0]
                if h_name not in seen:
                    res.append({
                        "name": h_name, "latin": r[1], "image": r[2], 
                        "preparation": r[3], "part": r[4], "part_image": r[5], 
                        "source_label": r[6], "source_link": r[7]
                    })
                    seen.add(h_name)
            return res

        grouped_results = []

        cur.execute("SELECT diagnosis, herbal_name FROM herbal_diagnoses")
        all_diags = cur.fetchall()

        cur.execute("SELECT symptom, herbal_name FROM herbal_symptoms")
        all_symps = cur.fetchall()

        # PROSES DIAGNOSIS
        for d in sel_diag:
            found = {r[1] for r in all_diags if r[0] and r[0].strip() == d and r[1]}
            safe = get_safe_herbs(found, sel_cond)
            if safe:
                details = get_details(safe)
                if details:
                    grouped_results.append({
                        "group_type": "Diagnosis",
                        "group_name": d,
                        "herbs": details
                    })

        # PROSES GEJALA
        for s in sel_symp:
            found = {r[1] for r in all_symps if r[0] and r[0].strip() == s and r[1]}
            safe = get_safe_herbs(found, sel_cond)
            if safe:
                details = get_details(safe)
                if details:
                    grouped_results.append({
                        "group_type": "Gejala",
                        "group_name": s,
                        "herbs": details
                    })

        # ---------------------------------------------------------
        # PENCATATAN RIWAYAT (LOGGING) KE TABEL search_history
        # ---------------------------------------------------------
      # PROSES GEJALA
        for s in sel_symp:
            found = {r[1] for r in all_symps if r[0] and r[0].strip() == s and r[1]}
            # ... (kode lainnya) ...

        # ---------------------------------------------------------
        # PENCATATAN RIWAYAT (LOGGING) KE TABEL search_history
        # ---------------------------------------------------------
        if grouped_results:  # <--- BARIS INI HARUS SEJAJAR DENGAN 'for' DI ATASNYA
            try:
                cur.execute("""
                    INSERT INTO search_history 
                    (wallet_address, diagnoses, symptoms, special_conditions, chemical_drugs, recommendations, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, NOW())
                """, (
                    wallet_addr,
                    json.dumps(sel_diag),
                    json.dumps(sel_symp),
                    json.dumps(raw_cond),
                    json.dumps(obat_kimia),
                    json.dumps(grouped_results)
                ))
                conn.commit()
                print(f"✅ Riwayat berhasil disimpan untuk: {wallet_addr}")
            except Exception as e:
                print(f"⚠️ Gagal menyimpan riwayat: {e}")
                conn.rollback() 
        # ---------------------------------------------------------
        
        cur.close()
        conn.close()

        return grouped_results

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# =========================================================
# ENDPOINT BARU: MENGAMBIL RIWAYAT BERDASARKAN WALLET
# =========================================================
@app.get("/api/history/{wallet_address}")
def get_user_history(wallet_address: str):
    try:
        conn = get_connection()
        cur = conn.cursor()
        
        # Mengambil riwayat terbaru di atas (ORDER BY created_at DESC)
        cur.execute("""
            SELECT id, diagnoses, symptoms, special_conditions, chemical_drugs, recommendations, created_at
            FROM search_history
            WHERE wallet_address = %s
            ORDER BY created_at DESC
        """, (wallet_address,))
        
        rows = cur.fetchall()
        cur.close()
        conn.close()

        history_list = []
        for r in rows:
            history_list.append({
                "id": r[0],
                "diagnoses": r[1],
                "symptoms": r[2],
                "special_conditions": r[3],
                "chemical_drugs": r[4],
                "recommendations": r[5],
                "created_at": r[6].isoformat() if r[6] else None # Cek dulu apakah tanggalnya ada            })
            }) #
        return history_list
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Gagal mengambil riwayat: {str(e)}")