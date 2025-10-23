import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

const VALID_STATUSES = ["pending", "accepted", "canceled"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método no permitido" });
  }

  try {
    const { product_name, category, estimated_weight, predicted_weight } = req.body;

    if (!product_name || !category || estimated_weight === undefined) {
      return res.status(400).json({
        success: false,
        error: "Faltan campos obligatorios: product_name, category, estimated_weight",
      });
    }

    const { data, error } = await supabaseAdmin.from("quotes").insert([
      {
        product_name,
        category,
        estimated_weight,
        predicted_weight,
        status: "pending", // siempre inicia en pending
      },
    ]).select().single();

    if (error) throw error;

    return res.status(201).json({ success: true, data });
  } catch (err: any) {
    console.error("Error creando quote:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
