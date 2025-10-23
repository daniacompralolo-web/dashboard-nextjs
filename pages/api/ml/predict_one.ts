// File: pages/api/ml/predict_one.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { exec } from "child_process";

type Data = {
  ok: boolean;
  message?: string;
  output?: any;
  error?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const { id } = req.body;
  const productId = Number(id);

  if (!productId || Number.isNaN(productId)) {
    return res.status(400).json({ ok: false, message: "Invalid product id" });
  }

  const cmd = `python ml/predict_and_update_single.py ${productId}`;

  exec(cmd, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) {
      console.error("Error ejecutando Python:", err, stderr);
      return res.status(500).json({ ok: false, message: "Error ejecutando script Python", error: stderr || err.message });
    }

    try {
      const parsed = JSON.parse(stdout);
      if (!parsed.ok) {
        return res.status(500).json({ ok: false, message: "Script returned error", output: parsed });
      }
      return res.status(200).json({ ok: true, message: "Prediction updated", output: parsed });
    } catch (e) {
      return res.status(200).json({ ok: true, message: "Script finished", output: stdout });
    }
  });
}
