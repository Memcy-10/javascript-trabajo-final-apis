// ═══════════════════════════════════════════════════════════
// app.js — Servidor HTTP nativo de Node.js
//
// IMPORTANTE: Este archivo NO usa Express ni ninguna librería
// externa. Solo usa módulos nativos de Node.js: http, fs, path y url.
//
// Responsabilidades:
//   1. Servir los archivos del frontend (HTML, CSS, JS)
//   2. Actuar de proxy hacia api.js para evitar errores de CORS
//   3. Recibir objetos guardados desde el frontend (POST /api/saved)
//   4. Devolver los objetos guardados al frontend (GET /api/saved)
//
// Toda la lógica de almacenamiento está en clases (POO).
//
// Para arrancar: node backend/app.js
// ═══════════════════════════════════════════════════════════

// Módulos nativos de Node.js — sin instalar nada
import http from 'http';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Importamos las funciones que hablan con Frankfurter
import {
  getCurrencies,
  getLatestRates,
  convertCurrency,
  getHistoricalRates,
  getTimeSeries
} from './api.js';

// __dirname no existe en módulos ES, lo reconstruimos
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Carpeta donde están los archivos del frontend
const FRONTEND_DIR = path.join(__dirname, '../frontend');

const PORT = 3000;


// ════════════════════════════════════════════════════════════
// POO — PROGRAMACIÓN ORIENTADA A OBJETOS
// ════════════════════════════════════════════════════════════

// ─── Clase: BusquedaGuardada ────────────────────────────
// Representa una búsqueda que el usuario decidió guardar.
// Cada instancia tiene un id único, el tipo de consulta,
// los datos del resultado y la fecha/hora en que se guardó.
class BusquedaGuardada {
  constructor(tipo, nombre, datos) {
    this.id     = Date.now();                          // ID único basado en timestamp
    this.tipo   = tipo;                                // 'latest' | 'convert' | 'historical' | 'series'
    this.nombre = nombre;                              // Nombre que le puso el usuario
    this.datos  = datos;                               // Objeto con los datos del resultado
    this.fecha  = new Date().toLocaleString('es-CO');  // Fecha y hora legible
  }

  // Método que devuelve un resumen de la búsqueda para mostrar en terminal
  resumen() {
    return `[${this.tipo.toUpperCase()}] "${this.nombre}" — guardado el ${this.fecha}`;
  }
}


// ─── Clase: Almacen ─────────────────────────────────────
// Administra la colección de búsquedas guardadas en memoria.
// Cuando el servidor se reinicia, los datos se pierden (en memoria).
class Almacen {
  constructor() {
    this.busquedas = []; // Array donde se guardan las instancias de BusquedaGuardada
  }

  // Guarda una nueva búsqueda y la muestra en la terminal
  guardar(tipo, nombre, datos) {
    const busqueda = new BusquedaGuardada(tipo, nombre, datos);
    this.busquedas.unshift(busqueda); // La añade al principio para mostrar la más reciente primero

    // Mensaje en terminal con los datos del objeto guardado
    console.log('\n✅ Nueva búsqueda guardada:');
    console.log('   ' + busqueda.resumen());
    console.log('   ID:', busqueda.id);
    console.log('   Datos:', JSON.stringify(busqueda.datos, null, 2));
    console.log('   Total guardadas:', this.busquedas.length);

    return busqueda;
  }

  // Devuelve todas las búsquedas guardadas
  obtenerTodas() {
    return this.busquedas;
  }

  // Elimina una búsqueda por su id
  eliminar(id) {
    const antes = this.busquedas.length;
    this.busquedas = this.busquedas.filter(b => b.id !== Number(id));
    const eliminada = antes > this.busquedas.length;

    if (eliminada) console.log(`\n🗑️  Búsqueda ${id} eliminada. Total: ${this.busquedas.length}`);
    return eliminada;
  }
}

// Creamos la única instancia del almacén (singleton)
const almacen = new Almacen();


// ════════════════════════════════════════════════════════════
// HELPERS DE SERVIDOR
// ════════════════════════════════════════════════════════════

// ─── Cabeceras CORS ─────────────────────────────────────
// Permite que el frontend en el navegador pueda hacer peticiones
// al servidor sin que el navegador las bloquee por seguridad.
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ─── Responder con JSON ──────────────────────────────────
// Helper para no repetir las cabeceras en cada ruta
function respondJSON(res, statusCode, data) {
  setCORS(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ─── Leer el body de una petición POST ──────────────────
// En Node nativo el body llega en chunks (pedazos), hay que
// juntarlos y parsear el JSON manualmente.
function leerBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); }); // Acumulamos cada pedazo
    req.on('end',  ()    => {
      try { resolve(JSON.parse(body)); }  // Parseamos el JSON completo
      catch (e) { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

// ─── Servir archivos estáticos del frontend ─────────────
// Lee el archivo del disco y lo sirve con el Content-Type correcto.
function servirArchivo(res, filePath) {
  // Mapa de extensiones a tipos MIME
  const tipos = {
    '.html': 'text/html',
    '.css':  'text/css',
    '.js':   'text/javascript',
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Si el archivo no existe respondemos 404
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Archivo no encontrado');
      return;
    }

    const ext      = path.extname(filePath);
    const mimeType = tipos[ext] || 'text/plain';

    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  });
}


// ════════════════════════════════════════════════════════════
// SERVIDOR HTTP NATIVO
// ════════════════════════════════════════════════════════════

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method;

  // ─── Preflight CORS ───────────────────────────────────
  // Los navegadores mandan OPTIONS antes de POST para verificar CORS
  if (method === 'OPTIONS') {
    setCORS(res);
    res.writeHead(204);
    res.end();
    return;
  }

  console.log(`${method} ${pathname}`); // Log de cada petición en terminal

  try {

    // ══════════════════════════════════════════════════════
    // RUTAS DE LA API (proxy hacia Frankfurter)
    // ══════════════════════════════════════════════════════

    // GET /api/currencies — Lista de monedas disponibles
    if (pathname === '/api/currencies' && method === 'GET') {
      const data = await getCurrencies();
      return respondJSON(res, 200, data);
    }

    // GET /api/latest?from=USD&to=EUR — Tasas actuales
    if (pathname === '/api/latest' && method === 'GET') {
      const params = new URL(req.url, `http://localhost:${PORT}`).searchParams;
      const data   = await getLatestRates(params.get('from'), params.get('to'));
      return respondJSON(res, 200, data);
    }

    // GET /api/convert?amount=100&from=USD&to=EUR — Conversión
    if (pathname === '/api/convert' && method === 'GET') {
      const params = new URL(req.url, `http://localhost:${PORT}`).searchParams;
      const data   = await convertCurrency(
        params.get('amount'),
        params.get('from'),
        params.get('to')
      );
      return respondJSON(res, 200, { ...data, amount: parseFloat(params.get('amount')) });
    }

    // GET /api/historical?date=2020-01-01&from=USD&to=EUR — Histórica
    if (pathname === '/api/historical' && method === 'GET') {
      const params = new URL(req.url, `http://localhost:${PORT}`).searchParams;
      if (!params.get('date')) return respondJSON(res, 400, { error: 'El parámetro date es obligatorio' });
      const data = await getHistoricalRates(params.get('date'), params.get('from'), params.get('to'));
      return respondJSON(res, 200, data);
    }

    // GET /api/series?start=...&end=...&from=...&to=... — Serie de tiempo
    if (pathname === '/api/series' && method === 'GET') {
      const params = new URL(req.url, `http://localhost:${PORT}`).searchParams;
      if (!params.get('start') || !params.get('end')) {
        return respondJSON(res, 400, { error: 'Los parámetros start y end son obligatorios' });
      }
      const data = await getTimeSeries(
        params.get('start'), params.get('end'),
        params.get('from'),  params.get('to')
      );
      return respondJSON(res, 200, data);
    }


    // ══════════════════════════════════════════════════════
    // RUTAS DE BÚSQUEDAS GUARDADAS (almacenamiento en servidor)
    // ══════════════════════════════════════════════════════

    // GET /api/saved — Devuelve todas las búsquedas guardadas
    if (pathname === '/api/saved' && method === 'GET') {
      return respondJSON(res, 200, almacen.obtenerTodas());
    }

    // POST /api/saved — Guarda una nueva búsqueda en el servidor
    // El frontend envía: { tipo, nombre, datos }
    if (pathname === '/api/saved' && method === 'POST') {
      const body = await leerBody(req);

      // Validamos que vengan los campos necesarios
      if (!body.tipo || !body.nombre || !body.datos) {
        return respondJSON(res, 400, { error: 'Faltan campos: tipo, nombre, datos' });
      }

      // Guardamos usando el Almacen (POO) — esto también imprime en terminal
      const busqueda = almacen.guardar(body.tipo, body.nombre, body.datos);
      return respondJSON(res, 201, busqueda);
    }

    // DELETE /api/saved/:id — Elimina una búsqueda por id
    if (pathname.startsWith('/api/saved/') && method === 'DELETE') {
      const id       = pathname.split('/').pop();
      const eliminada = almacen.eliminar(id);
      if (!eliminada) return respondJSON(res, 404, { error: 'Búsqueda no encontrada' });
      return respondJSON(res, 200, { ok: true });
    }


    // ══════════════════════════════════════════════════════
    // ARCHIVOS ESTÁTICOS DEL FRONTEND
    // ══════════════════════════════════════════════════════

    // Resolvemos la ruta del archivo pedido dentro de /frontend
    // Si piden "/" servimos index.html
    let filePath = path.join(FRONTEND_DIR, pathname === '/' ? 'index.html' : pathname);
    servirArchivo(res, filePath);

  } catch (err) {
    // Si algo falla inesperadamente, respondemos con error 500
    console.error('❌ Error en el servidor:', err.message);
    respondJSON(res, 500, { error: err.message });
  }
});


// ─── Arrancar el servidor ───────────────────────────────
server.listen(PORT, () => {
  console.log('═══════════════════════════════════════');
  console.log(`🚀  Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📁  Sirviendo frontend desde /frontend`);
  console.log(`🔌  Proxy hacia api.frankfurter.app`);
  console.log(`💾  Almacén en memoria (se borra al cerrar)`);
  console.log('═══════════════════════════════════════');
});
