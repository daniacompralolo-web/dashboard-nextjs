// File: pages/api/ml/import.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { exec } from "child_process";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { file } = req.body; // ejemplo: { "file": "ml/data/otro_archivo.xlsx" }
  const filePath = file || "ml/data/products_example.xlsx";

  exec(`python ml/import_history.py ${filePath}`, (err, stdout, stderr) => {
    if (err) {
      console.error("❌ Error ejecutando import:", err);
      return res.status(500).json({ message: "Error ejecutando import", error: stderr });
    }

    console.log("✅ Import completado:", stdout);
    res.status(200).json({ message: "Import completado", output: stdout });
  });
}
