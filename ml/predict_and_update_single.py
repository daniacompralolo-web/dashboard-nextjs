#!/usr/bin/env python3
"""
ml/predict_and_update_single.py <product_id>

Busca el producto en Supabase, predice su peso con ml/weight_model.pkl
y actualiza la fila con predicted_weight SOLO si está en estado "pending".
"""

import os
import sys
import json
import pickle
from dotenv import load_dotenv
from supabase import create_client, Client
import pandas as pd

# -----------------------
# 0) CONFIG
# -----------------------
load_dotenv()
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
MODEL_PATH = "ml/weight_model.pkl"


def die(msg, code=1):
    """Imprime error JSON y detiene ejecución"""
    print(json.dumps({"ok": False, "error": msg}))
    sys.exit(code)


if not SUPABASE_URL or not SUPABASE_KEY:
    die("Missing SUPABASE_URL or SUPABASE_KEY in .env")

if len(sys.argv) < 2:
    die("Usage: python ml/predict_and_update_single.py <product_id>")

try:
    product_id = int(sys.argv[1])
except Exception:
    die("product_id must be integer")

if not os.path.exists(MODEL_PATH):
    die(f"Model file not found: {MODEL_PATH}")

# -----------------------
# 1) Conectar a Supabase + cargar modelo
# -----------------------
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
with open(MODEL_PATH, "rb") as f:
    model = pickle.load(f)

# -----------------------
# 2) Obtener producto
# -----------------------
resp = supabase.table("products").select(
    "id, category, sub_category, status"
).eq("id", product_id).limit(1).execute()

data = resp.data
if not data:
    die(f"Product with id {product_id} not found")

product = data[0]
status = (product.get("status") or "").strip().lower()

# Solo predecimos si está en estado pending
if status != "pending":
    print(json.dumps({"ok": False, "skipped": True, "reason": f"Product not pending (status={status})"}))
    sys.exit(0)

category = (product.get("category") or "").strip().lower()
sub_category = (product.get("sub_category") or "").strip().lower()

# -----------------------
# 3) Preparar datos y predecir
# -----------------------
X = pd.DataFrame([{
    "category": category,
    "sub_category": sub_category
}])

try:
    pred = float(model.predict(X)[0])
except Exception as e:
    die(f"Model prediction error: {str(e)}")

# -----------------------
# 4) Actualizar Supabase
# -----------------------
try:
    supabase.table("products").update({
        "predicted_weight": pred
    }).eq("id", product_id).execute()
except Exception as e:
    die(f"Error updating Supabase: {str(e)}")

print(json.dumps({
    "ok": True,
    "id": product_id,
    "predicted_weight": pred,
    "status": status
}))
sys.exit(0)
