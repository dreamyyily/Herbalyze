from fastapi import FastAPI, Request
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
# FUNGSI REKOMENDASI (KAMUS KONDISI KHUSUS & ANTI-SPASI)
# =========================================================
@app.post("/api/recommend")
async def recommend_herbal(request: Request):
    try:
        data = await request.json()
        sel_diag = data.get('diagnosis', [])
        sel_symp = data.get('gejala', [])
        raw_cond = data.get('kondisi', [])

        # ---------------------------------------------------------
        # KAMUS PENERJEMAH (RULE-BASED MAPPING)
        # Mengubah bahasa UI (Frontend) menjadi bahasa mesin (Database)
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
        # ---------------------------------------------------------

        conn = get_connection()
        cur = conn.cursor()

        # Helper 1: Saring Herbal yang Dilarang (Mesin Rule-Based)
        def get_safe_herbs(herb_names, conditions):
            if not herb_names: return []
            if not conditions: return list(herb_names)
            
            cur.execute("""
                SELECT herbal_name FROM herbal_special_conditions 
                WHERE herbal_name = ANY(%s) AND special_condition = ANY(%s)
            """, (list(herb_names), conditions))
            unsafe = {row[0] for row in cur.fetchall() if row[0]}
            
            # Buang herbal yang ada di daftar bahaya
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

        cur.close()
        conn.close()

        return grouped_results

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}