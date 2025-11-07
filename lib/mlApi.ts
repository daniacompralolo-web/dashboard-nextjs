export interface PredictionInput {
  category: string;
  sub_category: string;
  feature1?: number;
  feature2?: number;
  feature3?: number;
  // agrega más si tu modelo los necesita
}

export interface PredictionResponse {
  prediction?: number;
  error?: string;
}

export async function getPrediction(
  data: PredictionInput
): Promise<PredictionResponse> {
  try {
    // URL del backend FastAPI (viene del .env)
    const apiUrl =
      process.env.NEXT_PUBLIC_ML_API_URL || "http://127.0.0.1:8000";

    const response = await fetch(`${apiUrl}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error("❌ Error al llamar a la API:", error);
    return { error: error.message };
  }
}
