import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Método no permitido" });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error("Error listing products:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
