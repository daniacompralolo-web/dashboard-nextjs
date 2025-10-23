"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import * as XLSX from "xlsx";

type Product = {
  id: number;
  product_name: string;
  category?: string | null;
  sub_category?: string | null;
  estimated_weight?: number | null;
  predicted_weight?: number | null;
  real_weight?: number | null;
  status: "pending" | "accepted" | "canceled";
  notes?: string | null;
  created_at?: string;
};

export default function DashboardPage() {
  const [active, setActive] = useState<"add" | "pending" | "accepted" | "canceled">("add");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "info" | "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({
    product_name: "",
    category: "",
    sub_category: "",
    estimated_weight: "" as number | "",
    notes: "",
  });
  const [weights, setWeights] = useState<Record<number, string>>({});

  async function fetchProducts() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from<Product>("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setProducts(data || []);
    } catch (err: any) {
      console.error("Error fetching products:", err.message || err);
      setMessage({ type: "error", text: "Error cargando productos" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProducts();
  }, []);

  const filtered = products.filter((p) => {
    if (active === "pending") return p.status === "pending";
    if (active === "accepted") return p.status === "accepted";
    if (active === "canceled") return p.status === "canceled";
    return false;
  });

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!form.product_name.trim()) {
      setMessage({ type: "info", text: "El nombre del producto es obligatorio." });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        product_name: form.product_name.trim(),
        category: form.category || null,
        sub_category: form.sub_category || null,
        estimated_weight: form.estimated_weight === "" ? null : Number(form.estimated_weight),
        notes: form.notes || null,
        status: "pending",
      };
      const { data: inserted, error } = await supabase.from("products").insert([payload]).select();
      if (error) throw error;
      setForm({ product_name: "", category: "", sub_category: "", estimated_weight: "", notes: "" });

      // 🔹 Llamar predicción automática para este producto
      if (inserted && inserted.length > 0) {
        try {
          const res = await fetch("/api/ml/predict_one", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: inserted[0].id }),
          });
          const result = await res.json();
          if (!result.ok) console.warn("Predicción fallida:", result.error);
        } catch (err) {
          console.error("Error prediciendo peso:", err);
        }
      }

      await fetchProducts();
      setActive("pending");
      setMessage({ type: "success", text: "Producto creado correctamente." });
    } catch (err: any) {
      console.error("Add error:", err);
      setMessage({ type: "error", text: "Error agregando producto." });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRealWeight(id: number) {
    setMessage(null);
    const value = weights[id];
    if (value === undefined || value === "") {
      setMessage({ type: "info", text: "Ingresa un peso válido." });
      return;
    }
    const num = Number(value);
    if (Number.isNaN(num) || num < 0) {
      setMessage({ type: "info", text: "Ingrese un número válido mayor o igual a 0." });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("products").update({ real_weight: num }).eq("id", id);
      if (error) throw error;
      await fetchProducts();
      setMessage({ type: "success", text: "Peso real guardado." });
    } catch (err: any) {
      console.error("Save weight error:", err);
      setMessage({ type: "error", text: "Error guardando peso real." });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeStatus(id: number, status: "accepted" | "canceled") {
    setSaving(true);
    try {
      const { error } = await supabase.from("products").update({ status }).eq("id", id);
      if (error) throw error;
      await fetchProducts();
      setMessage({ type: "success", text: `Producto ${status === "accepted" ? "aceptado" : "rechazado"}.` });
    } catch (err: any) {
      console.error("Change status error:", err);
      setMessage({ type: "error", text: "Error cambiando estado." });
    } finally {
      setSaving(false);
    }
  }

async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
  setMessage(null);
  const file = e.target.files?.[0];
  if (!file) return;
  setUploading(true);

  try {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

      const inserts: any[] = [];
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const product_name = row.product_name ?? row.name ?? row.Nombre ?? row.nombre;
        const category = row.category ?? row.Category ?? row.categoria ?? row.Categoria ?? null;
        const sub_category = row.sub_category ?? row.SubCategory ?? row.Sub_Categoria ?? null;
        const real_weight = row.real_weight ?? row.weight ?? row.peso ?? null;

        if (!product_name) {
          errors.push(`Fila ${i + 2}: falta product_name.`);
          continue;
        }

        inserts.push({
          product_name: String(product_name).trim(),
          category: category ? String(category).trim() : null,
          sub_category: sub_category ? String(sub_category).trim() : null,
          estimated_weight: null,
          predicted_weight: null,
          real_weight: real_weight ? Number(real_weight) : null,
          status: "accepted", // ✅ van directo a historial (aceptados)
          notes: null,
        });
      }

      const insertedProducts: any[] = [];
      const chunkSize = 200;

      for (let i = 0; i < inserts.length; i += chunkSize) {
        const chunk = inserts.slice(i, i + chunkSize);
        const { data: inserted, error } = await supabase.from("products").insert(chunk).select();
        if (error) {
          console.error("Error insertando chunk:", error);
          errors.push(`Error insertando chunk: ${error.message ?? JSON.stringify(error)}`);
          break;
        }
        insertedProducts.push(...inserted);
      }

      await fetchProducts(); // 🔄 Refresca tabla

      if (errors.length > 0) {
        setMessage({
          type: "error",
          text: `Importación completada con advertencias (${errors.length} errores).`,
        });
      } else {
        setMessage({
          type: "success",
          text: `Importación completada: ${insertedProducts.length} productos aceptados (peso real).`,
        });
      }
    };
    reader.readAsArrayBuffer(file);
  } catch (err: any) {
    console.error("Error procesando Excel:", err);
    setMessage({ type: "error", text: "Error procesando el archivo Excel." });
  } finally {
    setUploading(false);
    if (e.target) (e.target as HTMLInputElement).value = "";
  }
}



  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-indigo-900 font-bold text-white border-r hidden md:block">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-6">Admin</h2>
          <nav className="space-y-2">
            <button
              onClick={() => setActive("add")}
              className={`w-full text-left px-4 py-2 rounded-md ${active === "add" ? "bg-indigo-600 text-white" : "hover:bg-indigo-500"}`}
            >
              ➕ Agregar Producto
            </button>
            <button
              onClick={() => setActive("pending")}
              className={`w-full text-left px-4 py-2 rounded-md ${active === "pending" ? "bg-indigo-600 text-white" : "hover:bg-indigo-500"}`}
            >
              ⏳ Pendientes
            </button>
            <button
              onClick={() => setActive("accepted")}
              className={`w-full text-left px-4 py-2 rounded-md ${active === "accepted" ? "bg-indigo-600 text-white" : "hover:bg-indigo-500"}`}
            >
              ✅ Historial (Aceptados)
            </button>
            <button
              onClick={() => setActive("canceled")}
              className={`w-full text-left px-4 py-2 rounded-md ${active === "canceled" ? "bg-indigo-600 text-white" : "hover:bg-indigo-500"}`}
            >
              ❌ Rechazados
            </button>
          </nav>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl text-gray-800 font-bold">Gestión de Productos</h1>
          </div>
          <div>
            <button
              className="px-3 py-2 bg-indigo-600 text-white text-bold border border-gray-600 rounded mr-2"
              onClick={() => {
                fetchProducts();
                setMessage({ type: "info", text: "Refrescando..." });
                setTimeout(() => setMessage(null), 800);
              }}
            >
              🔄 Refrescar
            </button>
          </div>
        </div>

        {message && (
          <div
            className={`mb-4 p-3 rounded ${
              message.type === "success"
                ? "bg-green-50 text-green-800"
                : message.type === "error"
                ? "bg-red-50 text-red-800"
                : "bg-yellow-50 text-yellow-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <section className="space-y-6 py-2 px-2">
          {/* --- ADD --- */}
          {active === "add" && (
            <div className="bg-indigo-100 border border-indigo-200 rounded shadow-sm p-8 py-8 px-4 max-w-3xl">
              <h2 className="text-lg text-gray-800 font-semibold mb-4">➕ Agregar Producto</h2>
              <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-800 font-medium mb-1">Nombre del producto *</label>
                  <input
                    className="w-full border rounded text-black border-gray-900 px-3 py-2"
                    value={form.product_name}
                    onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                    placeholder="Ej. Caja metálica 40x40"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-800 font-medium mb-1">Categoría</label>
                  <input
                    className="w-full text-gray-800 border rounded px-3 py-2"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="General / Fragile / Heavy"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-800 font-medium mb-1">Subcategoría</label>
                  <input
                    className="w-full text-gray-800 border rounded px-3 py-2"
                    value={form.sub_category}
                    onChange={(e) => setForm({ ...form, sub_category: e.target.value })}
                    placeholder="Ej. Electrónica / Hogar"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-800 font-medium mb-1">Peso estimado (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full text-gray-800 border rounded px-3 py-2"
                    value={form.estimated_weight ?? ""}
                    onChange={(e) => setForm({ ...form, estimated_weight: e.target.value === "" ? "" : Number(e.target.value) })}
                    placeholder="Ej. 12.50"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-800 font-medium mb-1">Notas</label>
                  <textarea
                    className="w-full text-gray-800 border rounded px-3 py-2"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={3}
                    placeholder="Observaciones..."
                  />
                </div>

                <div className="md:col-span-2 flex items-center gap-3">
                  <button type="submit" className="px-4 py-2 bg-indigo-600  text-white rounded" disabled={saving}>
                    {saving ? "Guardando..." : "Agregar producto"}
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 border rounded "
                    onClick={() => {
                      setForm({ product_name: "", category: "", sub_category: "", estimated_weight: "", notes: "" });
                      setMessage(null);
                    }}
                  >
                    Limpiar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* --- PENDING --- */}
          {active === "pending" && (
            <div className="bg-indigo-100 border border-indigo-200 rounded shadow-sm p-6">
              <h2 className="text-lg text-gray-800 font-semibold mb-4">Pendientes</h2>
              {loading ? (
                <p>Cargando...</p>
              ) : filtered.length === 0 ? (
                <p className="text-gray-500">No hay productos pendientes.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-indigo-900 border border-indigo-800 text-white">
                        <th className="px-4 py-3 text-left font-medium">ID</th>
                        <th className="px-4 py-3 text-left font-medium">Producto</th>
                        <th className="px-4 py-3 text-left font-medium">Categoría</th>
                        <th className="px-4 py-3 text-left font-medium">Subcategoría</th>
                        <th className="px-4 py-3 text-left font-medium">Estimado</th>
                        <th className="px-4 py-3 text-left font-medium">Predicho</th>
                        <th className="px-4 py-3 text-left font-medium">Creado</th>
                        <th className="px-4 py-3 text-left font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p) => (
                        <tr key={p.id} className="border border-indigo-900">
                          <td className="px-4 py-3 text-gray-800">{p.id}</td>
                          <td className="px-4 py-3 text-gray-800">{p.product_name}</td>
                          <td className="px-4 py-3 text-gray-800">{p.category ?? "-"}</td>
                          <td className="px-4 py-3 text-gray-800">{p.sub_category ?? "-"}</td>
                          <td className="px-4 py-3 text-gray-800">{p.estimated_weight ?? "-"}</td>
                          <td className="px-4 py-3 text-gray-800">{p.predicted_weight ?? "-"}</td>
                          <td className="px-4 py-3 text-gray-800">{p.created_at ? new Date(p.created_at).toLocaleString() : "-"}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button onClick={() => handleChangeStatus(p.id, "accepted")} className="px-3 py-1 rounded bg-green-600 text-white text-sm">
                                Aceptar
                              </button>
                              <button onClick={() => handleChangeStatus(p.id, "canceled")} className="px-3 py-1 rounded bg-red-600 text-white text-sm">
                                Rechazar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* --- ACCEPTED (HISTORIAL) --- */}
          {active === "accepted" && (
            <div className="bg-indigo-100 rounded shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg text-gray-800 font-semibold">Aceptados (Historial)</h2>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600">Importar Excel (.xlsx/.xls/.csv)</label>
                  <label className="px-3 py-2 bg-indigo-600 text-white rounded cursor-pointer hover:bg-indigo-700">
                    Seleccionar archivo
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
                  </label>
                  {uploading && <span className="text-gray-500">Importando...</span>}
                </div>
              </div>

              {loading ? (
                <p>Cargando...</p>
              ) : filtered.length === 0 ? (
                <p className="text-gray-500">No hay productos aceptados.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-indigo-900 border border-indigo-800 text-white">
                        <th className="px-4 py-3 text-left font-medium ">ID</th>
                        <th className="px-4 py-3 text-left font-medium">Producto</th>
                        <th className="px-4 py-3 text-left font-medium">Categoría</th>
                        <th className="px-4 py-3 text-left font-medium">Subcategoría</th>
                        <th className="px-4 py-3 text-left font-medium">Estimado</th>
                        <th className="px-4 py-3 text-left font-medium">Predicho</th>
                        <th className="px-4 py-3 text-left font-medium">Real</th>
                        <th className="px-4 py-3 text-left font-medium">Notas</th>
                        <th className="px-4 py-3 text-left font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p) => (
                        <tr key={p.id} className="border border-indigo-800 ">
                          <td className="px-4 py-3 text-gray-800">{p.id}</td>
                          <td className="px-4 py-3 text-gray-800">{p.product_name}</td>
                          <td className="px-4 py-3 text-gray-800">{p.category ?? "-"}</td>
                          <td className="px-4 py-3 text-gray-800">{p.sub_category ?? "-"}</td>
                          <td className="px-4 py-3 text-gray-800">{p.estimated_weight ?? "-"}</td>
                          <td className="px-4 py-3 text-gray-800">{p.predicted_weight ?? "-"}</td>
                          <td className="px-4 py-3 text-gray-800">
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              className="w-24 border rounded px-2 py-1 text-gray-800"
                              value={weights[p.id] ?? (p.real_weight ?? "")}
                              onChange={(e) => setWeights((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            />
                          </td>
                          <td className="px-4 py-3 text-gray-800">{p.notes ?? "-"}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => handleSaveRealWeight(p.id)} className="px-3 py-1 bg-indigo-800 text-white rounded" disabled={saving}>
                              {saving ? "Guardando..." : "Guardar"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* --- CANCELED --- */}
          {active === "canceled" && (
            <div className="bg-indigo-100 rounded shadow-sm p-6">
              <h2 className="text-lg text-gray-800 font-semibold mb-4">Rechazados</h2>
              {loading ? (
                <p>Cargando...</p>
              ) : filtered.length === 0 ? (
                <p className="text-gray-500">No hay productos rechazados.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-indigo-900 border border-indigo-800 text-white ">
                        <th className="px-4 py-3 text-left font-medium ">ID</th>
                        <th className="px-4 py-3 text-left font-medium">Producto</th>
                        <th className="px-4 py-3 text-left font-medium">Categoría</th>
                        <th className="px-4 py-3 text-left font-medium">Subcategoría</th>
                        <th className="px-4 py-3 text-left font-medium">Estimado</th>
                        <th className="px-4 py-3 text-left font-medium">Creado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p) => (
                        <tr key={p.id} className="border border-indigo-800 ">
                          <td className="px-4 py-3 text-gray-800">{p.id}</td>
                          <td className="px-4 py-3 text-gray-800">{p.product_name}</td>
                          <td className="px-4 py-3 text-gray-800">{p.category ?? "-"}</td>
                          <td className="px-4 py-3 text-gray-800">{p.sub_category ?? "-"}</td>
                          <td className="px-4 py-3 text-gray-800">{p.estimated_weight ?? "-"}</td>
                          <td className="px-4 py-3 text-gray-500">{p.created_at ? new Date(p.created_at).toLocaleString() : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
