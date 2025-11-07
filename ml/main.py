from fastapi import FastAPI
import uvicorn
import pandas as pd
import numpy as np
import pickle

# Inicializar la app
app = FastAPI(title="Modelo de Predicción de Peso", version="1.0")

# Cargar el modelo entrenado
with open("weight_model.pkl", "rb") as f:
    model = pickle.load(f)
    
# Ruta raíz
@app.get("/")
def root():
    return {"message": "🚀 API de predicción funcionando correctamente"}

# Endpoint de predicción
@app.post("/predict")
def predict(data: dict):
    """
    Espera un diccionario JSON con los datos necesarios para el modelo.
    Ejemplo:
    {
      "feature1": 5.3,
      "feature2": 2.1,
      "feature3": 0.8
    }
    """
    try:
        # Convertir los datos en DataFrame
        df = pd.DataFrame([data])

        # Realizar predicción
        prediction = model.predict(df)

        # Devolver resultado
        return {"prediction": float(prediction[0])}

    except Exception as e:
        return {"error": str(e)}

# Punto de entrada (para Railway)
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
