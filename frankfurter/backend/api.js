// ═══════════════════════════════════════════════════════════
// api.js — Comunicación directa con la API de Frankfurter
//
// Este archivo es el único que habla con api.frankfurter.app.
// Su única responsabilidad es hacer las peticiones HTTP a la
// API externa y devolver los datos como objetos JavaScript.
//
// app.js importa estas funciones y las usa para responder
// las peticiones que llegan desde el frontend.
//
// IMPORTANTE: No usa ninguna librería externa, solo el fetch
// nativo de Node.js (disponible desde Node 18+).
// ═══════════════════════════════════════════════════════════

// URL base de la API pública de Frankfurter.
// Al tenerla en una constante, si cambia solo se edita aquí.
const BASE_URL = 'https://api.frankfurter.app';


// ─── Función helper privada ─────────────────────────────
// Hace el fetch a Frankfurter y lanza un error si algo falla.
// Todas las funciones exportadas la usan para no repetir código.
//
// Parámetro:
//   url → URL completa a consultar
// Retorna:
//   El objeto JSON de respuesta, o lanza un Error si falla
async function fetchFrankfurter(url) {
  const response = await fetch(url);

  // Si la API responde con un código de error HTTP (4xx, 5xx) lo lanzamos
  if (!response.ok) {
    throw new Error(`Error al consultar Frankfurter: código ${response.status}`);
  }

  // Parseamos y retornamos el JSON
  return response.json();
}


// ─── Obtener lista de monedas disponibles ───────────────
// Devuelve un objeto con todos los códigos y nombres de monedas.
// Ejemplo de respuesta: { "USD": "US Dollar", "EUR": "Euro", ... }
//
// Se usa al cargar la página para llenar los selectores.
export async function getCurrencies() {
  return fetchFrankfurter(`${BASE_URL}/currencies`);
}


// ─── Obtener tasas actuales ─────────────────────────────
// Devuelve las tasas de cambio del día de hoy.
//
// Parámetros:
//   from → moneda base (ej: "USD")
//   to   → monedas destino separadas por coma, opcional (ej: "EUR,GBP")
//          si no se envía, devuelve todas las monedas disponibles
//
// Ejemplo de respuesta:
//   { base: "USD", date: "2024-06-01", rates: { EUR: 0.92, GBP: 0.79 } }
export async function getLatestRates(from, to) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to)   params.set('to', to);

  const query = params.toString() ? '?' + params.toString() : '';
  return fetchFrankfurter(`${BASE_URL}/latest${query}`);
}


// ─── Convertir una cantidad entre dos monedas ───────────
// Le pasa el parámetro "amount" a Frankfurter para que
// devuelva el resultado ya multiplicado.
//
// Parámetros:
//   amount → cantidad a convertir (ej: 100)
//   from   → moneda origen (ej: "USD")
//   to     → moneda destino (ej: "EUR")
//
// Ejemplo de respuesta:
//   { amount: 100, base: "USD", date: "2024-06-01", rates: { EUR: 92.0 } }
export async function convertCurrency(amount, from, to) {
  const params = new URLSearchParams({ amount, from, to });
  return fetchFrankfurter(`${BASE_URL}/latest?${params.toString()}`);
}


// ─── Tasas en una fecha histórica específica ────────────
// Devuelve las tasas que existían en un día concreto del pasado.
// Frankfurter tiene datos históricos desde el año 1999.
//
// Parámetros:
//   date → fecha en formato YYYY-MM-DD (ej: "2020-03-15")
//   from → moneda base (ej: "EUR")
//   to   → monedas destino, opcional (ej: "USD,GBP")
export async function getHistoricalRates(date, from, to) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to)   params.set('to', to);

  const query = params.toString() ? '?' + params.toString() : '';
  return fetchFrankfurter(`${BASE_URL}/${date}${query}`);
}


// ─── Serie de tiempo entre dos fechas ───────────────────
// Devuelve la tasa de cambio para cada día dentro de un rango.
// Útil para ver la evolución histórica y pintar una gráfica.
//
// Parámetros:
//   start → fecha inicio YYYY-MM-DD (ej: "2024-01-01")
//   end   → fecha fin   YYYY-MM-DD  (ej: "2024-06-01")
//   from  → moneda base (ej: "USD")
//   to    → moneda destino (ej: "EUR")
//
// Frankfurter usa el formato /inicio..fin para series de tiempo.
export async function getTimeSeries(start, end, from, to) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to)   params.set('to', to);

  const query = params.toString() ? '?' + params.toString() : '';
  return fetchFrankfurter(`${BASE_URL}/${start}..${end}${query}`);
}
