  import type { NextApiRequest, NextApiResponse } from "next";
  import { supabase } from "@/lib/supabaseClient";

  export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "PUT") {
      return res.status(405).json({ error: "Metodo no valido" });
    }

    try {
      const { id, status, ...updateFields } = req.body;

      if (!id) {
        return res.status(400).json({ error: "Se requiere el id de la cotización" });
      }

      // 🔹 Actualizamos la quote
      const { data: updatedQuote, error: updateError } = await supabase
        .from("quotes")
        .update({ status, ...updateFields })
        .eq("id", id)
        .select()
        .single();

      if (updateError) throw updateError;

      // 🔹 Si la orden fue aceptada → la pasamos a history
      if (status === "accepted") {
        const { error: historyError } = await supabase.from("history").insert([
          {
            quote_id: updatedQuote.id,
            product_name: updatedQuote.product_name,
            category: updatedQuote.category,
            estimated_weight: updatedQuote.estimated_weight,
            predicted_weight: updatedQuote.predicted_weight,
          },
        ]);

        if (historyError) throw historyError;
      }

      // 🔹 Si fue cancelada → solo queda en quotes (no hacemos nada extra)

      return res.status(200).json(updatedQuote);
    } catch (error: any) {
      console.error("Error updating quote:", error);
      return res.status(500).json({ error: error.message });
    }
  }
