import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    return res.status(405).json({ success: false, error: "Método no permitido" });
  }

  const { id, ...updates } = req.body;

  if (!id) {
    return res.status(400).json({ success: false, error: "ID requerido" });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("history")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
