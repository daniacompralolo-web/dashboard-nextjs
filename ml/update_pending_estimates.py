import os
import pickle
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv

# -----------------------
# 0️⃣ Load env
# -----------------------
load_dotenv()
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
MODEL_PATH = "ml/weight_model.pkl"

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing Supabase credentials in .env")
    exit()

# -----------------------
# 1️⃣ Connect to Supabase
# -----------------------
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# -----------------------
# 2️⃣ Load model
# -----------------------
if not os.path.exists(MODEL_PATH):
    print("❌ Model not found. Run train_predict_model.py first.")
    exit()

with open(MODEL_PATH, "rb") as f:
    model = pickle.load(f)

# -----------------------
# 3️⃣ Fetch pending products
# -----------------------
print("🔎 Fetching pending products without real_weight...")
response = supabase.table("products").select(
    "id, product_name, category, sub_category, real_weight, status"
).eq("status", "pending").is_("real_weight", None).execute()

pending = response.data
if not pending:
    print("✅ No pending products to update.")
    exit()

df = pd.DataFrame(pending)

# -----------------------
# 4️⃣ Normalize strings
# -----------------------
for col in ["category", "sub_category"]:
    df[col] = df[col].astype(str).str.strip().str.lower()

# -----------------------
# 5️⃣ Predict
# -----------------------
X_pred = df[["sub_category", "category"]]
df["predicted_weight"] = model.predict(X_pred)

# -----------------------
# 6️⃣ Update Supabase
# -----------------------
for _, row in df.iterrows():
    supabase.table("products").update({
        "real_weight": float(row["predicted_weight"]),
        "status": "estimated"
    }).eq("id", row["id"]).execute()

print(f"🎉 Updated {len(df)} products with estimated weights.")
