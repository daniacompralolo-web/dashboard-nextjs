import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

const VALID_STATUSES = ["pending", "accepted", "canceled", "history"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    return res.status(405).json({ success: false, error: "Método no permitido" });
  }

  const { id, status, real_weight, ...fields } = req.body;

  if (!id) {
    return res.status(400).json({ success: false, error: "ID requerido" });
  }

  try {
    let updates: any = { ...fields };

    // 🔹 Validar status si viene en la request
    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, error: "Estado no válido" });
      }
      updates.status = status;
    }

    // 🔹 Actualizar sub_category si viene
    if ('sub_category' in fields) {
      updates.sub_category = fields.sub_category ?? null;
    }

    // 🔹 Si llega real_weight, guardamos en history
    if (real_weight !== undefined) {
      updates.real_weight = real_weight;
      updates.status = "history"; // mover a historial

      // Buscar producto para insertar en history
      const { data: product, error: fetchError } = await supabaseAdmin
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Insertar en history
      const { error: historyError } = await supabaseAdmin.from("history").insert([
        {
          quote_id: product.id, // relación
          product_name: product.product_name,
          category: product.category,
          sub_category: product.sub_category, // <-- agregado
          estimated_weight: product.estimated_weight,
          real_weight,
          predicted_weight: product.predicted_weight,
        },
      ]);

      if (historyError) throw historyError;
    }

    // 🔹 Actualizar producto en tabla principal
    const { data, error } = await supabaseAdmin
      .from("products")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ success: true, message: "Producto actualizado", data });
  } catch (err: any) {
    console.error("Error updating product:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
