// File: pages/api/ml/train.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { exec } from "child_process";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  exec("python ml/train_predict_model.py", (err, stdout, stderr) => {
    if (err) {
      console.error("❌ Error ejecutando entrenamiento:", err);
      return res.status(500).json({ message: "Error ejecutando entrenamiento", error: stderr });
    }

    console.log("✅ Entrenamiento completado:", stdout);
    res.status(200).json({ message: "Entrenamiento completado", output: stdout });
  });
}
