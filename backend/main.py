from fastapi import FastAPI
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

    cur.execute("""
        SELECT DISTINCT diagnosis
        FROM herbal_diagnoses
        ORDER BY diagnosis;
    """)

    rows = cur.fetchall()
    cur.close()
    conn.close()
    
    cleaned = sorted(set(row[0].strip() for row in rows if row[0]))
    return cleaned

@app.get("/api/symptoms")
def get_symptoms():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT DISTINCT symptom
        FROM herbal_symptoms
        ORDER BY symptom;
    """)

    rows = cur.fetchall()

    cur.close()
    conn.close()
    
    cleaned = sorted(set(row[0].strip() for row in rows if row[0]))
    return cleaned

@app.get("/api/herbs")
def get_herbs():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT herbal_name FROM herbal_diagnoses
        UNION
        SELECT herbal_name FROM herbal_symptoms;
    """)

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