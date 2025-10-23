const API_BASE = "/api";

// ----------------------
// Products
// ----------------------
export async function getProducts(id?: number) {
  let url = `${API_BASE}/products/get`;
  if (id) url += `?id=${id}`;
  const res = await fetch(url);
  return res.json();
}

export async function listProducts() {
  const res = await fetch(`${API_BASE}/products/list`);
  return res.json();
}

export async function addProduct(product: any) {
  const res = await fetch(`${API_BASE}/products/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(product),
  });
  return res.json();
}

export async function updateProduct(id: number, updates: any) {
  const res = await fetch(`${API_BASE}/products/update`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...updates }),
  });
  return res.json();
}

// ----------------------
// Quotes (opcional)
// ----------------------
export async function getQuotes() {
  const res = await fetch(`${API_BASE}/quotes/get`);
  return res.json();
}

export async function addQuote(quote: any) {
  const res = await fetch(`${API_BASE}/quotes/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(quote),
  });
  return res.json();
}

export async function updateQuote(id: string, updates: any) {
  const res = await fetch(`${API_BASE}/quotes/update`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...updates }),
  });
  return res.json();
}
