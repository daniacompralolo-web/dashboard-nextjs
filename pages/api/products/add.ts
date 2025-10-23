// File: pages/api/products/add.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { exec } from "child_process";

const VALID_STATUSES = ["pending", "accepted", "canceled", "quoting"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método no permitido" });
  }

  const { product_name, estimated_weight, category, sub_category, status, notes } = req.body;

  if (!product_name || !product_name.trim()) {
    return res.status(400).json({ success: false, error: "El nombre del producto es obligatorio" });
  }

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, error: "Estado no válido" });
  }

  try {
    // 1️⃣ Insertar el producto
    const { data, error } = await supabaseAdmin
      .from("products")
      .insert([
        {
          product_name: product_name.trim(),
          estimated_weight: estimated_weight ?? null,
          category: category ?? null,
          sub_category: sub_category ?? null,
          status: status ?? "pending",
          notes: notes ?? null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // 2️⃣ Si está en estado "pending", ejecutamos el script de predicción
    if ((status ?? "pending") === "pending" && data?.id) {
      const cmd = `python ml/predict_and_update_single.py ${data.id}`;
      exec(cmd, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          console.error("❌ Error ejecutando Python:", err.message);
          return;
        }
        console.log("✅ Predicción completada:", stdout || stderr);
      });
    }

    return res.status(200).json({
      success: true,
      message: "Producto creado correctamente",
      data,
    });
  } catch (err: any) {
    console.error("Error creando producto:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
