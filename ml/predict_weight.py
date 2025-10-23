import pickle
import pandas as pd
import sys
import os

MODEL_PATH = "ml/weight_model.pkl"

# -----------------------
# 1️⃣ Check model exists
# -----------------------
if not os.path.exists(MODEL_PATH):
    print(f"❌ Model not found: {MODEL_PATH}. Run train_predict_model.py first.")
    sys.exit(1)

# Load the model
with open(MODEL_PATH, "rb") as f:
    model = pickle.load(f)

# -----------------------
# 2️⃣ Read input from command line
# -----------------------
if len(sys.argv) < 4:
    print("Usage: python predict_weight.py <category> <sub_category> <product_name>")
    sys.exit(1)

category = sys.argv[1].strip().lower()
sub_category = sys.argv[2].strip().lower()
product_name = sys.argv[3].strip()

# -----------------------
# 3️⃣ Create DataFrame
# -----------------------
input_df = pd.DataFrame([{
    "category": category,
    "sub_category": sub_category,
    "product_name": product_name
}])

# -----------------------
# 4️⃣ Predict
# -----------------------
prediction = model.predict(input_df)[0]
print(f"Predicted weight for '{product_name}' ({category} / {sub_category}): {prediction:.2f}")
