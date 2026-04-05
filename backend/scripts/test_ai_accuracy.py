import requests
import json
import time
from typing import Optional

# ─── KONFIGURASI ─────────────────────────────────────────
BASE_URL = "http://127.0.0.1:8000"
ENDPOINT = f"{BASE_URL}/api/recommend_hybrid"

# Threshold similarity yang dipakai sistem (88%)
SIMILARITY_THRESHOLD = 88.0

TEST_CASES = [
    # ─── LAPIS 1: EXACT MATCH (SQL) ─────────────────────────
    {
        "id": "TC-01",
        "category": "Exact Match",
        "description": "Keluhan persis sama dengan nama diagnosis di DB",
        "query_text": "pasien mengalami diabetes",
        "kondisi": [],
        "expected_groups": ["Diabetes"],
        "expected_herbs": [],   # kosongkan jika tidak ingin cek per-herbal
    },
    {
        "id": "TC-02",
        "category": "Exact Match",
        "description": "Keluhan gejala persis di DB",
        "query_text": "pasien mengeluh demam",
        "kondisi": [],
        "expected_groups": ["Demam"],
        "expected_herbs": [],
    },
    {
        "id": "TC-03",
        "category": "Exact Match",
        "description": "Keluhan ganda: diagnosis + gejala",
        "query_text": "pasien didiagnosis hipertensi dan mengalami sakit kepala",
        "kondisi": [],
        "expected_groups": ["Hipertensi", "Sakit kepala"],
        "expected_herbs": [],
    },
    {
        "id": "TC-04",
        "category": "Exact Match",
        "description": "Keluhan maag persis",
        "query_text": "mengidap maag",
        "kondisi": [],
        "expected_groups": ["Maag"],
        "expected_herbs": [],
    },

    # ─── LAPIS 2: SINONIM / BAHASA AWAM (AI SBERT) ──────────
    {
        "id": "TC-05",
        "category": "AI Synonym",
        "description": "Sinonim diabetes: kencing manis",
        "query_text": "pasien menderita kencing manis",
        "kondisi": [],
        "expected_groups": ["Diabetes"],
        "expected_herbs": [],
    },
    {
        "id": "TC-06",
        "category": "AI Synonym",
        "description": "Sinonim hipertensi: tekanan darah tinggi",
        "query_text": "tekanan darahnya tinggi sekali",
        "kondisi": [],
        "expected_groups": ["Hipertensi"],
        "expected_herbs": [],
    },
    {
        "id": "TC-07",
        "category": "AI Synonym",
        "description": "Sinonim maag: perih lambung",
        "query_text": "perut bagian lambung terasa perih",
        "kondisi": [],
        "expected_groups": ["Maag"],
        "expected_herbs": [],
    },
    {
        "id": "TC-08",
        "category": "AI Synonym",
        "description": "Sinonim diare: mencret",
        "query_text": "BAB cair terus menerus alias mencret",
        "kondisi": [],
        "expected_groups": ["Diare"],
        "expected_herbs": [],
    },
    {
        "id": "TC-09",
        "category": "AI Synonym",
        "description": "Bahasa medis: hiperkolesterolemia → kolesterol",
        "query_text": "kadar kolesterol pasien sangat tinggi",
        "kondisi": [],
        "expected_groups": ["Kolesterol"],
        "expected_herbs": [],
    },

    # ─── KONDISI KHUSUS: FILTER KEAMANAN ────────────────────
    {
        "id": "TC-10",
        "category": "Safety Filter",
        "description": "Ibu hamil: herbal berbahaya harus difilter",
        "query_text": "pasien mengalami mual",
        "kondisi": ["Ibu hamil"],
        "expected_groups": ["Mual"],  # grup harus muncul
        "expected_herbs": [],         # herbal berbahaya harus TIDAK muncul
    },
    {
        "id": "TC-11",
        "category": "Safety Filter",
        "description": "Anak balita dengan demam",
        "query_text": "anak demam tinggi",
        "kondisi": ["Anak di bawah lima tahun"],
        "expected_groups": ["Demam"],
        "expected_herbs": [],
    },

    # ─── KALIMAT MEDIS PANJANG (SUBJEKTIF) ──────────────────
    {
        "id": "TC-12",
        "category": "Medical Note",
        "description": "Catatan medis keseluruhan",
        "query_text": "pasien didiagnosis dengan diabetes mellitus tipe 2 disertai hipertensi dan mengeluhkan sering pusing",
        "kondisi": [],
        "expected_groups": ["Diabetes", "Hipertensi", "Pusing"],
        "expected_herbs": [],
    },
    {
        "id": "TC-13",
        "category": "Medical Note",
        "description": "Multi keluhan gejala",
        "query_text": "pasien mengalami batuk, pilek, dan demam",
        "kondisi": [],
        "expected_groups": ["Batuk", "Pilek", "Demam"],
        "expected_herbs": [],
    },

    # ─── NEGATIF / NOISE ─────────────────────────────────────
    {
        "id": "TC-14",
        "category": "Negative",
        "description": "Input tidak relevan / noise murni",
        "query_text": "pasien ingin konsultasi soal keuangan",
        "kondisi": [],
        "expected_groups": [],   # sistem tidak boleh merekomendasikan apa pun
        "expected_herbs": [],
    },
    {
        "id": "TC-15",
        "category": "Negative",
        "description": "Kata-kata medis tapi tidak ada di DB",
        "query_text": "pasien mengalami sindrom tourette",
        "kondisi": [],
        "expected_groups": [],
        "expected_herbs": [],
    },
]


# ─── FUNGSI UTAMA ─────────────────────────────────────────

def normalize(name: str) -> str:
    """Normalisasi nama grup untuk perbandingan case-insensitive."""
    return name.strip().lower()


def call_api(query_text: str, kondisi: list) -> Optional[list]:
    """Panggil endpoint /api/recommend_hybrid dan kembalikan hasilnya."""
    payload = {
        "wallet_address": "testing_script",
        "query_text": query_text,
        "kondisi": kondisi,
        "obat_kimia": []
    }
    try:
        resp = requests.post(ENDPOINT, json=payload, timeout=60)
        if resp.status_code == 200:
            return resp.json()
        else:
            print(f"    ⚠️  API Error {resp.status_code}: {resp.text[:200]}")
            return None
    except requests.exceptions.ConnectionError:
        print("    🔴 Koneksi gagal! Pastikan server uvicorn berjalan di port 8000.")
        return None
    except Exception as e:
        print(f"    ❌ Exception: {e}")
        return None


def compute_metrics(predicted_groups: list, expected_groups: list) -> dict:
    """
    Hitung Precision, Recall, F1 untuk satu test case.
    
    Untuk setiap expected group:
      - TP: group yang diharapkan DAN ditemukan sistem
      - FP: group yang ditemukan sistem tapi TIDAK diharapkan
      - FN: group yang diharapkan tapi TIDAK ditemukan sistem

    Catatan: Jika expected_groups kosong (Negative case):
      - Jika sistem juga mengembalikan kosong → correct (TN)
      - Jika sistem mengembalikan sesuatu     → wrong (FP)
    """
    pred_set = set(normalize(g) for g in predicted_groups)
    exp_set  = set(normalize(g) for g in expected_groups)

    # Kasus Negatif murni
    if not exp_set:
        if not pred_set:
            return {"TP": 0, "FP": 0, "FN": 0, "TN": 1,
                    "precision": 1.0, "recall": 1.0, "f1": 1.0, "correct": True}
        else:
            fp = len(pred_set)
            return {"TP": 0, "FP": fp, "FN": 0, "TN": 0,
                    "precision": 0.0, "recall": 1.0, "f1": 0.0, "correct": False}

    tp = len(pred_set & exp_set)
    fp = len(pred_set - exp_set)
    fn = len(exp_set - pred_set)

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall    = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1        = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    correct   = (tp == len(exp_set) and fp == 0)

    return {
        "TP": tp, "FP": fp, "FN": fn, "TN": 0,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "correct": correct
    }


def run_tests():
    print("=" * 70)
    print("  🌿 HERBALYZE — TESTING AKURASI REKOMENDASI AI")
    print("=" * 70)
    print(f"  Total Test Case : {len(TEST_CASES)}")
    print(f"  Endpoint        : {ENDPOINT}")
    print(f"  Waktu           : {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    all_results = []
    total_precision = 0.0
    total_recall    = 0.0
    total_f1        = 0.0
    correct_count   = 0

    categories_summary = {}

    for tc in TEST_CASES:
        print(f"\n▶ [{tc['id']}] {tc['description']}")
        print(f"   Kategori    : {tc['category']}")
        print(f"   Query       : \"{tc['query_text']}\"")
        print(f"   Kondisi     : {tc['kondisi'] if tc['kondisi'] else 'Normal'}")
        print(f"   Expected    : {tc['expected_groups']}")

        start = time.time()
        api_result = call_api(tc["query_text"], tc["kondisi"])
        elapsed = (time.time() - start) * 1000

        if api_result is None:
            print(f"   ❌ SKIP — API tidak merespons")
            continue

        predicted_groups = [r.get("group_name", "") for r in api_result]
        print(f"   Predicted   : {predicted_groups}")
        print(f"   Waktu API   : {elapsed:.0f} ms")

        metrics = compute_metrics(predicted_groups, tc["expected_groups"])

        status_icon = "✅" if metrics["correct"] else "❌"
        print(f"   {status_icon} Precision={metrics['precision']:.2f} | "
              f"Recall={metrics['recall']:.2f} | "
              f"F1={metrics['f1']:.2f}")

        if metrics["FN"] > 0:
            missed = set(normalize(g) for g in tc["expected_groups"]) - \
                     set(normalize(g) for g in predicted_groups)
            print(f"   ⚠️  Tidak terdeteksi: {list(missed)}")
        if metrics["FP"] > 0:
            extra = set(normalize(g) for g in predicted_groups) - \
                    set(normalize(g) for g in tc["expected_groups"])
            print(f"   ⚠️  Terdeteksi tapi salah: {list(extra)}")

        total_precision += metrics["precision"]
        total_recall    += metrics["recall"]
        total_f1        += metrics["f1"]
        if metrics["correct"]:
            correct_count += 1

        # Per-kategori
        cat = tc["category"]
        if cat not in categories_summary:
            categories_summary[cat] = {"total": 0, "correct": 0, "f1_sum": 0.0}
        categories_summary[cat]["total"]   += 1
        categories_summary[cat]["correct"] += (1 if metrics["correct"] else 0)
        categories_summary[cat]["f1_sum"]  += metrics["f1"]

        all_results.append({
            "id": tc["id"],
            "category": tc["category"],
            "query": tc["query_text"],
            "expected": tc["expected_groups"],
            "predicted": predicted_groups,
            "metrics": metrics,
            "response_ms": round(elapsed, 1)
        })

    # ─── RINGKASAN AKHIR ──────────────────────────────────────
    n = len(all_results)
    avg_precision = total_precision / n if n > 0 else 0
    avg_recall    = total_recall    / n if n > 0 else 0
    avg_f1        = total_f1        / n if n > 0 else 0
    accuracy      = correct_count   / n if n > 0 else 0

    print("\n" + "=" * 70)
    print("  📊 RINGKASAN HASIL TESTING")
    print("=" * 70)
    print(f"  Total Test Case  : {n}")
    print(f"  ✅ Benar          : {correct_count}")
    print(f"  ❌ Salah          : {n - correct_count}")
    print("-" * 70)
    print(f"  Accuracy         : {accuracy * 100:.2f}%")
    print(f"  Avg Precision    : {avg_precision * 100:.2f}%")
    print(f"  Avg Recall       : {avg_recall * 100:.2f}%")
    print(f"  Avg F1-Score     : {avg_f1 * 100:.2f}%")
    print("=" * 70)

    # Per-kategori
    print("\n  📂 HASIL PER KATEGORI:")
    print(f"  {'Kategori':<20} {'Correct/Total':<15} {'Avg F1':>8}")
    print(f"  {'-'*45}")
    for cat, v in categories_summary.items():
        avg_cat_f1 = v["f1_sum"] / v["total"] if v["total"] > 0 else 0
        print(f"  {cat:<20} {v['correct']}/{v['total']:<14} {avg_cat_f1*100:>7.2f}%")

    # Simpan hasil ke JSON
    output_path = "scripts/test_results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "summary": {
                "total": n,
                "correct": correct_count,
                "accuracy": round(accuracy, 4),
                "avg_precision": round(avg_precision, 4),
                "avg_recall": round(avg_recall, 4),
                "avg_f1": round(avg_f1, 4),
            },
            "per_category": {
                cat: {
                    "correct": v["correct"],
                    "total": v["total"],
                    "avg_f1": round(v["f1_sum"] / v["total"], 4) if v["total"] > 0 else 0
                }
                for cat, v in categories_summary.items()
            },
            "detail": all_results
        }, f, ensure_ascii=False, indent=2)

    print(f"\n  💾 Hasil detail tersimpan di: {output_path}")
    print("=" * 70)

    # Interpretasi
    print("\n  💡 INTERPRETASI:")
    if avg_f1 >= 0.85:
        print("  🟢 SANGAT BAIK  — Model AI bekerja akurat. Siap untuk produksi.")
    elif avg_f1 >= 0.70:
        print("  🟡 CUKUP BAIK   — Ada ruang perbaikan, terutama di kasus sinonim.")
    elif avg_f1 >= 0.50:
        print("  🟠 PERLU PERBAIKAN — Banyak kasus sinonim tidak terdeteksi.")
    else:
        print("  🔴 KURANG BAIK  — Perlu review dataset ChromaDB dan threshold.")
    print("=" * 70)


if __name__ == "__main__":
    run_tests()
