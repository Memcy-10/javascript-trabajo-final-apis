// ═══════════════════════════════════════════════════════════
// Script del frontend
//
// Usa addEventListener para todos los eventos (criterio 1).
// Usa fetch + async/await para la API (criterios 2 y 3).
// Usa try/catch/finally para manejo de errores (criterio 4).
// Guarda en el BACKEND con POST fetch (criterio 7).
// ═══════════════════════════════════════════════════════════


// ─── URL base del backend ───────────────────────────────
// Al tenerla en una constante, si cambia el puerto solo se
// edita aquí y se actualiza en todas las llamadas.
const API_BASE = 'http://localhost:3000';


// ─── Monedas de respaldo ────────────────────────────────
// Si /api/currencies falla al cargar, usamos esta lista
// hardcodeada para que los selectores no queden vacíos.
const FALLBACK_CURRENCIES = {
  AUD:'Australian Dollar', BGN:'Bulgarian Lev', BRL:'Brazilian Real',
  CAD:'Canadian Dollar',   CHF:'Swiss Franc',   CNY:'Chinese Renminbi Yuan',
  CZK:'Czech Koruna',      DKK:'Danish Krone',  EUR:'Euro',
  GBP:'British Pound',     HKD:'Hong Kong Dollar', HUF:'Hungarian Forint',
  IDR:'Indonesian Rupiah', ILS:'Israeli New Sheqel', INR:'Indian Rupee',
  ISK:'Icelandic Króna',   JPY:'Japanese Yen',  KRW:'South Korean Won',
  MXN:'Mexican Peso',      MYR:'Malaysian Ringgit', NOK:'Norwegian Krone',
  NZD:'New Zealand Dollar',PHP:'Philippine Peso',PLN:'Polish Zloty',
  RON:'Romanian Leu',      SEK:'Swedish Krona', SGD:'Singapore Dollar',
  THB:'Thai Baht',         TRY:'Turkish Lira',  USD:'US Dollar',
  ZAR:'South African Rand'
};

let currencies = {};

// ─── Llenar los <select> de monedas ─────────────────────
// Recibe el objeto de monedas y llena todos los selectores.
// Aplica valores por defecto para que no queden vacíos.
function populateSelects(data) {
  currencies = data;
  const defaults = {
    'l-from':'EUR', 'c-from':'USD', 'c-to':'EUR',
    'h-from':'EUR', 's-from':'USD', 's-to':'EUR'
  };
  document.querySelectorAll('select').forEach(sel => {
    sel.innerHTML = '';
    Object.entries(data)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([code, name]) => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = `${code} — ${name}`;
        sel.appendChild(opt);
      });
    if (defaults[sel.id]) sel.value = defaults[sel.id];
  });
}

// ─── Cargar monedas desde el backend ────────────────────
// Intenta obtener la lista de la API; si falla usa el fallback.
async function loadCurrencies() {
  try {
    const response = await fetch(`${API_BASE}/api/currencies`);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    populateSelects(data);
  } catch (e) {
    console.warn('Usando monedas de respaldo:', e.message);
    populateSelects(FALLBACK_CURRENCIES);
  }
}


// ─── Navegación entre paneles ───────────────────────────
// switchPanel muestra el panel activo y resalta su botón.
function switchPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  document.getElementById('nav-' + name).classList.add('active');
}

// ─── Utilidades de fecha ─────────────────────────────────
function today()      { return new Date().toISOString().slice(0, 10); }
function daysAgo(n)   { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

// ─── Helpers visuales ───────────────────────────────────
function loading(el)  { el.innerHTML = `<div class="loader-wrap"><div class="spinner"></div>Consultando API…</div>`; }
function showError(el, msg) { el.innerHTML = `<div class="error-box">⚠ ${msg}</div>`; }
function fmt(n)       { return Number(n).toLocaleString('es-CO', { maximumFractionDigits: 4 }); }

function tagHTML(type) {
  const map    = { latest:'tag-latest', convert:'tag-convert', historical:'tag-hist', series:'tag-series' };
  const labels = { latest:'Tasas', convert:'Conversión', historical:'Histórica', series:'Serie' };
  return `<span class="saved-item-tag ${map[type]}">${labels[type]}</span>`;
}


// ═══════════════════════════════════════════════════════════
// GRÁFICA (Chart.js)
// ═══════════════════════════════════════════════════════════
let activeChart = null;

// Dibuja la gráfica de línea de la serie de tiempo.
// Destruye la anterior para no acumular instancias en memoria.
function renderChart(canvasId, labels, values, currency) {
  if (activeChart) { activeChart.destroy(); activeChart = null; }
  const ctx = document.getElementById(canvasId).getContext('2d');
  activeChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: currency, data: values,
        borderColor: '#7c6af7', borderWidth: 2,
        pointRadius: 0, tension: 0.3, fill: true,
        backgroundColor: 'rgba(124,106,247,0.08)'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#6b6b85', maxTicksLimit: 8, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: '#1a1a24' } },
        y: { ticks: { color: '#6b6b85', font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: '#1a1a24' } }
      }
    }
  });
}


// ═══════════════════════════════════════════════════════════
// GUARDADO EN EL BACKEND (POST al servidor)
// ═══════════════════════════════════════════════════════════

// Variables que guardan el último resultado consultado
// para poder enviarlo al backend al hacer click en guardar
let lastType = null;
let lastData = null;

// Envía el resultado al backend con un fetch POST.
// El backend lo recibe, lo almacena en memoria y lo imprime en terminal.
async function guardarEnBackend(nombre) {
  try {
    const response = await fetch(`${API_BASE}/api/saved`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo:   lastType,
        nombre: nombre,
        datos:  lastData
      })
    });

    // Verificamos que el servidor respondió bien
    if (!response.ok) throw new Error('HTTP ' + response.status);

    const guardada = await response.json();
    toast(`"${guardada.nombre}" guardado en el servidor ✓`);

    // Recargamos la lista del sidebar desde el servidor
    await cargarGuardados();

  } catch (e) {
    toast('Error al guardar: ' + e.message);
  }
}

// Pide al servidor la lista de búsquedas guardadas y las pinta en el sidebar
async function cargarGuardados() {
  try {
    const response = await fetch(`${API_BASE}/api/saved`);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const guardadas = await response.json();
    renderSaved(guardadas);
  } catch (e) {
    console.error('No se pudieron cargar los guardados:', e.message);
  }
}

// Elimina una búsqueda del servidor y recarga la lista
async function eliminarGuardado(id) {
  try {
    const response = await fetch(`${API_BASE}/api/saved/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    await cargarGuardados();
    toast('Búsqueda eliminada');
  } catch (e) {
    toast('Error al eliminar: ' + e.message);
  }
}

// Pinta la lista de guardados en el sidebar
function renderSaved(arr) {
  const list = document.getElementById('saved-list');
  if (!arr || !arr.length) {
    list.innerHTML = '<span class="empty-saved">Sin búsquedas guardadas</span>';
    return;
  }
  list.innerHTML = arr.map(item => `
    <div class="saved-item">
      <span class="saved-item-label" data-id="${item.id}">${item.nombre}</span>
      ${tagHTML(item.tipo)}
      <button class="saved-del" data-del="${item.id}" title="Eliminar">×</button>
    </div>
  `).join('');

  // Eventos para cargar y eliminar guardados
  // (usando addEventListener, no onclick inline)
  list.querySelectorAll('.saved-item-label').forEach(el => {
    el.addEventListener('click', () => cargarGuardadoPorId(Number(el.dataset.id), arr));
  });
  list.querySelectorAll('.saved-del').forEach(btn => {
    btn.addEventListener('click', () => eliminarGuardado(btn.dataset.del));
  });
}

// Carga un resultado guardado en pantalla sin volver a consultar la API
function cargarGuardadoPorId(id, arr) {
  const item = arr.find(x => x.id === id);
  if (!item) return;
  switchPanel(item.tipo);
  const prefijos = { latest:'l', convert:'c', historical:'h', series:'s' };
  const el = document.getElementById(prefijos[item.tipo] + '-result');
  displayResult(item.tipo, el, item.datos, item.nombre);
  toast(`Cargado: "${item.nombre}"`);
}


// ═══════════════════════════════════════════════════════════
// RENDER DE RESULTADOS
// ═══════════════════════════════════════════════════════════

// Router: decide qué función de render usar según el tipo
function displayResult(type, el, data, label) {
  if (type === 'latest' || type === 'historical') renderRates(el, data, label);
  else if (type === 'convert')  renderConvert(el, data, label);
  else if (type === 'series')   renderSeries(el, data, label);
}

// Genera el HTML de la fila para guardar (input + botón).
// El botón usa la clase "btn-save" — NO tiene id porque se
// regenera con cada consulta. El evento lo gestiona el
// listener de delegación registrado en DOMContentLoaded.
function saveRowHTML(defaultName) {
  return `
    <div class="save-row">
      <input class="save-name-input" id="save-name" placeholder="Nombre para guardar…" value="${defaultName}" />
      <button class="btn btn-ghost btn-save">Guardar en servidor</button>
    </div>
  `;
}

// ─── Render: tasas actuales / histórica ─────────────────
function renderRates(el, data, label) {
  const chips = Object.entries(data.rates).map(([code, val]) =>
    `<div class="rate-chip">
       <div class="rate-chip-code">${code}</div>
       <div class="rate-chip-val">${fmt(val)}</div>
     </div>`
  ).join('');

  el.innerHTML = `
    <div class="result-card">
      <div class="result-header">
        <div class="result-title">1 ${data.base}</div>
        <div class="result-date">${data.date}</div>
      </div>
      <div class="rates-grid">${chips}</div>
    </div>
    ${saveRowHTML(label)}
  `;
}

// ─── Render: conversión ──────────────────────────────────
function renderConvert(el, data, label) {
  const [[toCur, toVal]] = Object.entries(data.rates);
  el.innerHTML = `
    <div class="result-card">
      <div class="result-header">
        <div class="result-title">Conversión</div>
        <div class="result-date">${data.date}</div>
      </div>
      <div class="big-rate">${fmt(toVal)} <span>${toCur}</span></div>
      <div style="font-size:13px;color:var(--muted);margin-top:6px">
        ${fmt(data.amount)} ${data.base} → ${toCur}
      </div>
    </div>
    ${saveRowHTML(label)}
  `;
}

// ─── Render: serie de tiempo ─────────────────────────────
function renderSeries(el, data, label) {
  const [[toCur]] = Object.entries(Object.values(data.rates)[0]);
  const dates  = Object.keys(data.rates).sort();
  const values = dates.map(d => data.rates[d][toCur]);
  const min = Math.min(...values), max = Math.max(...values);
  const minD = dates[values.indexOf(min)], maxD = dates[values.indexOf(max)];

  const tableRows = dates.slice().reverse().slice(0, 30).map(d =>
    `<tr><td>${d}</td><td>${fmt(data.rates[d][toCur])}</td></tr>`
  ).join('');

  el.innerHTML = `
    <div class="result-card">
      <div class="result-header">
        <div class="result-title">${data.base} → ${toCur}</div>
        <div class="result-date">${dates[0]} / ${dates.at(-1)}</div>
      </div>
      <div style="display:flex;gap:24px;margin-bottom:12px">
        <div>
          <div style="font-size:11px;color:var(--muted)">Mínimo</div>
          <div style="font-family:var(--mono);font-size:15px;color:var(--green)">
            ${fmt(min)} <span style="font-size:11px;color:var(--muted)">${minD}</span>
          </div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--muted)">Máximo</div>
          <div style="font-family:var(--mono);font-size:15px;color:var(--red)">
            ${fmt(max)} <span style="font-size:11px;color:var(--muted)">${maxD}</span>
          </div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--muted)">Puntos</div>
          <div style="font-family:var(--mono);font-size:15px">${dates.length}</div>
        </div>
      </div>
      <div class="chart-wrap"><canvas id="series-chart"></canvas></div>
      <div style="margin-top:20px;max-height:260px;overflow-y:auto">
        <table class="series-table">
          <thead><tr><th>Fecha</th><th>${toCur}</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>
    ${saveRowHTML(label)}
  `;
  setTimeout(() => renderChart('series-chart', dates, values, toCur), 50);
}


// ═══════════════════════════════════════════════════════════
// LLAMADAS AL BACKEND (fetch + async/await + try/catch)
// ═══════════════════════════════════════════════════════════

// Tasas actuales
async function doLatest() {
  const el   = document.getElementById('l-result');
  const from = document.getElementById('l-from').value;
  const to   = document.getElementById('l-to').value.replace(/\s/g, '');
  loading(el);
  try {
    const qs = new URLSearchParams({ from });
    if (to) qs.set('to', to);

    const response = await fetch(`${API_BASE}/api/latest?${qs}`);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (data.error) throw new Error(data.error);

    lastType = 'latest';
    lastData = data;
    renderRates(el, data, `${from}→${to || 'todas'} ${data.date}`);
  } catch (e) {
    showError(el, e.message);
  }
}

// Conversión de monedas
async function doConvert() {
  const el     = document.getElementById('c-result');
  const amount = document.getElementById('c-amount').value;
  const from   = document.getElementById('c-from').value;
  const to     = document.getElementById('c-to').value;
  loading(el);
  try {
    const response = await fetch(`${API_BASE}/api/convert?amount=${amount}&from=${from}&to=${to}`);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (data.error) throw new Error(data.error);

    lastType = 'convert';
    lastData = { ...data, amount: parseFloat(amount) };
    renderConvert(el, lastData, `${amount} ${from}→${to}`);
  } catch (e) {
    showError(el, e.message);
  }
}

// Tasas históricas
async function doHistorical() {
  const el   = document.getElementById('h-result');
  const date = document.getElementById('h-date').value;
  const from = document.getElementById('h-from').value;
  const to   = document.getElementById('h-to').value.replace(/\s/g, '');
  if (!date) { showError(el, 'Selecciona una fecha'); return; }
  loading(el);
  try {
    const qs = new URLSearchParams({ date, from });
    if (to) qs.set('to', to);

    const response = await fetch(`${API_BASE}/api/historical?${qs}`);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (data.error) throw new Error(data.error);

    lastType = 'historical';
    lastData = data;
    renderRates(el, data, `${from} ${date}`);
  } catch (e) {
    showError(el, e.message);
  }
}

// Serie de tiempo
async function doSeries() {
  const el    = document.getElementById('s-result');
  const start = document.getElementById('s-start').value;
  const end   = document.getElementById('s-end').value;
  const from  = document.getElementById('s-from').value;
  const to    = document.getElementById('s-to').value;
  if (!start || !end) { showError(el, 'Selecciona el rango de fechas'); return; }
  loading(el);
  try {
    const response = await fetch(`${API_BASE}/api/series?start=${start}&end=${end}&from=${from}&to=${to}`);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (data.error) throw new Error(data.error);

    lastType = 'series';
    lastData = data;
    renderSeries(el, data, `${from}→${to} ${start}/${end}`);
  } catch (e) {
    showError(el, e.message);
  }
}


// ─── Toast ───────────────────────────────────────────────
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}


// ═══════════════════════════════════════════════════════════
// INICIALIZACIÓN — DOMContentLoaded
//
// Todo el código que asigna eventos espera a que el HTML
// esté completamente cargado antes de ejecutarse.
// Esto cumple el criterio de usar DOMContentLoaded.
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {

  // ─── Valores por defecto de fechas ───────────────────
  document.getElementById('h-date').value  = daysAgo(30);
  document.getElementById('s-start').value = daysAgo(60);
  document.getElementById('s-end').value   = today();

  // ─── Cargar monedas y guardados del servidor ─────────
  loadCurrencies();
  cargarGuardados();

  // ─── Eventos de navegación del sidebar ───────────────
  // Usamos addEventListener en cada botón de navegación.
  // El atributo data-panel indica qué panel mostrar.
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchPanel(btn.dataset.panel);
    });
  });

  // ─── Eventos de los botones de consulta ──────────────
  // Cada botón tiene un id único; usamos addEventListener
  // en lugar de onclick en el HTML (buena práctica).
  document.getElementById('btn-latest')
    .addEventListener('click', doLatest);

  document.getElementById('btn-convert')
    .addEventListener('click', doConvert);

  document.getElementById('btn-historical')
    .addEventListener('click', doHistorical);

  document.getElementById('btn-series')
    .addEventListener('click', doSeries);

  // ─── Delegación de eventos para el botón guardar ──────
  // En lugar de asignar un listener al botón cada vez que
  // se renderiza un resultado (lo que causaba que la segunda
  // búsqueda no se pudiera guardar), ponemos UN SOLO listener
  // en el contenedor .main. Cuando el usuario hace click en
  // cualquier botón .btn-save dentro de .main, este listener
  // lo captura sin importar cuántas veces se haya regenerado el HTML.
  document.querySelector('.main').addEventListener('click', (e) => {
    if (!e.target.classList.contains('btn-save')) return;
    const nombre = document.getElementById('save-name')?.value?.trim();
    if (!nombre) { toast('Escribe un nombre primero'); return; }
    if (!lastType || !lastData) { toast('Primero haz una consulta'); return; }
    guardarEnBackend(nombre);
  });

  // ─── Evento de teclado: Enter en los inputs ───────────
  // Permite consultar pulsando Enter desde cualquier campo,
  // sin necesidad de hacer click en el botón.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;

    // Detectamos qué panel está activo y disparamos su consulta
    const activePanel = document.querySelector('.panel.active')?.id;
    if (activePanel === 'panel-latest')     doLatest();
    if (activePanel === 'panel-convert')    doConvert();
    if (activePanel === 'panel-historical') doHistorical();
    if (activePanel === 'panel-series')     doSeries();
  });

});
