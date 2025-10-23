// File: pages/api/ml/update.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { exec } from "child_process";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  exec("python ml/update_pending_estimates.py", (err, stdout, stderr) => {
    if (err) {
      console.error("❌ Error ejecutando actualización:", err);
      return res.status(500).json({ message: "Error ejecutando actualización", error: stderr });
    }

    console.log("✅ Actualización completada:", stdout);
    res.status(200).json({ message: "Actualización completada", output: stdout });
  });
}
