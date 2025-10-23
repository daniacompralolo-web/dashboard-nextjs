import os
import math
import pandas as pd
from supabase import create_client, Client
import sys

# -----------------------
# 0️⃣ Configuración
# -----------------------
SUPABASE_URL = "https://rpmakxdbtvamgomcduab.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwbWFreGRidHZhbWdvbWNkdWFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY5MzUxOSwiZXhwIjoyMDczMjY5NTE5fQ.AdzD1D88W0tngx6aRe5ZuUQFDePqxMZIZcrCTLx6aqA"

# -----------------------
# 1️⃣ Recibir Excel como argumento
# -----------------------
if len(sys.argv) > 1:
    EXCEL_FILE = sys.argv[1]
else:
    EXCEL_FILE = "ml/history_import.xlsx"  # default

BATCH_SIZE = 500

# -----------------------
# 2️⃣ Conectar a Supabase
# -----------------------
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# -----------------------
# 3️⃣ Cargar Excel
# -----------------------
if not os.path.exists(EXCEL_FILE):
    print(f"❌ Excel file not found: {EXCEL_FILE}")
    raise SystemExit(1)

print(f"📂 Reading: {EXCEL_FILE}")
df = pd.read_excel(EXCEL_FILE, engine="openpyxl")

if df.empty:
    print("❌ The Excel file is empty.")
    raise SystemExit(1)

# -----------------------
# 4️⃣ Normalizar y validar columnas
# -----------------------
df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")

col_map = {
    "product_name": ["product_name", "name", "item_name"],
    "category": ["category", "group", "type"],
    "sub_category": ["sub_category", "sub_group", "sub_type"],
    "real_weight": ["real_weight", "weight", "actual_weight"]
}

def find_col(possible_names):
    for n in possible_names:
        if n in df.columns:
            return n
    return None

product_name_col = find_col(col_map["product_name"])
category_col = find_col(col_map["category"])
sub_category_col = find_col(col_map["sub_category"])
real_weight_col = find_col(col_map["real_weight"])

missing = []
if not product_name_col: missing.append("product_name")
if not category_col: missing.append("category")
if not sub_category_col: missing.append("sub_category")
if not real_weight_col: missing.append("real_weight")

if missing:
    print(f"❌ Missing required column(s) in Excel: {missing}")
    raise SystemExit(1)

df = df[[product_name_col, category_col, sub_category_col, real_weight_col]].rename(columns={
    product_name_col: "product_name",
    category_col: "category",
    sub_category_col: "sub_category",
    real_weight_col: "real_weight"
})

# -----------------------
# 5️⃣ Limpiar datos
# -----------------------
for col in ["product_name", "category", "sub_category"]:
    df[col] = df[col].astype(str).str.strip()

df["real_weight"] = pd.to_numeric(df["real_weight"], errors="coerce")

before = len(df)
df = df.dropna(subset=["real_weight"])
df = df[(df["product_name"] != "") & (df["category"] != "") & (df["sub_category"] != "")]
after = len(df)

dropped = before - after
if dropped > 0:
    print(f"⚠️ Dropped {dropped} invalid rows (missing/invalid values).")

if len(df) == 0:
    print("❌ No valid rows to import after cleaning.")
    raise SystemExit(1)

df["status"] = "history"
records = df.to_dict(orient="records")

# -----------------------
# 6️⃣ Insertar en batches
# -----------------------
total = len(records)
batches = math.ceil(total / BATCH_SIZE)
print(f"🚀 Importing {total} records in {batches} batch(es) of {BATCH_SIZE}...")

inserted = 0
for i in range(0, total, BATCH_SIZE):
    batch = records[i:i + BATCH_SIZE]
    try:
        res = supabase.table("products").insert(batch).execute()
        inserted += len(batch)
        print(f"✅ Batch {i//BATCH_SIZE + 1}/{batches} inserted ({inserted}/{total})")
    except Exception as e:
        print(f"❌ Batch {i//BATCH_SIZE + 1} failed: {e}")

print(f"🎉 Done! Inserted ~{inserted}/{total} rows as history.")
print("👉 Next: retrain your model to include this new data:")
print("    python ml/train_predict_model.py")
