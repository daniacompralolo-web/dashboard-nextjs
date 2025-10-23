import os
import pickle
import pandas as pd
from supabase import create_client, Client
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBRegressor
from dotenv import load_dotenv

# -----------------------
# 0️⃣ Load environment variables
# -----------------------
load_dotenv()
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing SUPABASE_URL or SUPABASE_KEY in .env file.")
    exit()

# -----------------------
# 1️⃣ Connect to Supabase
# -----------------------
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# -----------------------
# 2️⃣ Fetch data
# -----------------------
print("Fetching data from Supabase...")
response = supabase.table("products").select("sub_category, category, real_weight").execute()
data = response.data

if not data or len(data) < 2:
    print("❌ Not enough data in Supabase. Add at least 2 products with real_weight.")
    exit()

df = pd.DataFrame(data)

# -----------------------
# 3️⃣ Drop rows with missing real_weight
# -----------------------
df = df.dropna(subset=["real_weight"])
if len(df) < 2:
    print("❌ Not enough valid data to train ML model after dropping missing weights.")
    exit()

# -----------------------
# 4️⃣ Normalize categorical columns
# -----------------------
for col in ["sub_category", "category"]:
    if col not in df.columns:
        print(f"❌ Missing column in Supabase data: {col}")
        exit()
    df[col] = df[col].astype(str).str.strip().str.lower()

# -----------------------
# 5️⃣ Features & target
# -----------------------
X = df[["sub_category", "category"]]
y = df["real_weight"]

# -----------------------
# 6️⃣ Preprocessing
# -----------------------
preprocessor = ColumnTransformer(
    transformers=[
        ("cat", OneHotEncoder(handle_unknown="ignore"), ["sub_category", "category"])
    ]
)

# -----------------------
# 7️⃣ ML pipeline
# -----------------------
model_pipeline = Pipeline(steps=[
    ("preprocessor", preprocessor),
    ("regressor", XGBRegressor(n_estimators=100, learning_rate=0.1, max_depth=6, random_state=42))
])

# -----------------------
# 8️⃣ Train/test split
# -----------------------
if len(df) > 3:
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
else:
    X_train, y_train = X, y
    X_test, y_test = None, None

# -----------------------
# 9️⃣ Train model
# -----------------------
print("Training model...")
model_pipeline.fit(X_train, y_train)

# -----------------------
# 🔟 Evaluate
# -----------------------
if X_test is not None and len(y_test) > 1:
    score = model_pipeline.score(X_test, y_test)
    print(f"✅ Model R² score: {score:.4f}")
else:
    print("⚠️ Skipping evaluation (not enough test samples).")

# -----------------------
# 1️⃣1️⃣ Save model
# -----------------------
os.makedirs("ml", exist_ok=True)
with open("ml/weight_model.pkl", "wb") as f:
    pickle.dump(model_pipeline, f)

print("✅ Model trained and saved as ml/weight_model.pkl")
