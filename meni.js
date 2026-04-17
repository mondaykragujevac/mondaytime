/* meni.js — render menija sa opcionalnim Google Sheets izvorom.
 *
 * Google Sheet format (prva vrsta = zaglavlje):
 *   Category | Id | Icon | Name | Price
 *
 * Kako povezati:
 * 1. Napravi Sheet sa kolonama iznad (Icon je Font Awesome ime bez "fa-", npr. "mug-hot").
 * 2. File → Share → Publish to web → izaberi list → CSV → Publish.
 * 3. Zalepi URL u MENU_SHEET_CSV_URL ispod i pushni.
 */

const MENU_SHEET_CSV_URL = ""; // npr: "https://docs.google.com/spreadsheets/d/e/XXX/pub?output=csv"

/* ---- Renderer ---- */
function renderMenu(data) {
  const root = document.getElementById("menu-root");
  if (!root) return;

  const html = data.map((cat, idx) => {
    const items = (cat.items || []).map(it => {
      const price = (it.price || "").toString().trim();
      const priceHtml = price
        ? `<span class="price-value">${escapeHtml(price)}</span>`
        : `<span class="price-value muted">—</span>`;
      return `
        <div class="price-row">
          <span class="price-name">${escapeHtml(it.name || "")}</span>
          <span class="price-dots"></span>
          ${priceHtml}
        </div>`;
    }).join("");
    const iconName = (cat.icon || "mug-hot").replace(/^fa-/, "");
    const id = cat.id || "cat-" + idx;
    return `
      <section id="${escapeHtml(id)}" class="menu-category reveal">
        <div class="menu-category-head">
          <div class="icon-wrap"><i class="fa-solid fa-${escapeHtml(iconName)}"></i></div>
          <h2>${escapeHtml(cat.category || "")}</h2>
          <div class="divider-star"><span>✦</span></div>
        </div>
        <div class="price-table">${items}</div>
      </section>
    `;
  }).join("");

  root.innerHTML = html;

  // Re-observe any new .reveal elements
  if (window.__menuIO) {
    document.querySelectorAll('.reveal').forEach(el => {
      if (!el.classList.contains('in')) window.__menuIO.observe(el);
    });
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

/* ---- CSV parser ---- */
function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (inQ) {
      if (c === '"' && n === '"') { cell += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else { cell += c; }
    } else {
      if (c === '"') { inQ = true; }
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c === "\r") { /* skip */ }
      else { cell += c; }
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function rowsToMenu(rows) {
  if (!rows.length) return [];
  const header = rows[0].map(h => h.trim().toLowerCase());
  const col = name => header.indexOf(name);
  const iC = col("category"), iI = col("id"), iIc = col("icon"),
        iN = col("name"), iP = col("price");
  if (iC < 0 || iN < 0) return [];

  const byCat = new Map();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every(x => !String(x).trim())) continue;
    const catName = (row[iC] || "").trim();
    if (!catName) continue;
    if (!byCat.has(catName)) {
      byCat.set(catName, {
        category: catName,
        id: (iI >= 0 ? row[iI] : "").trim() || slugify(catName),
        icon: (iIc >= 0 ? row[iIc] : "").trim() || "mug-hot",
        items: []
      });
    }
    byCat.get(catName).items.push({
      name: (row[iN] || "").trim(),
      price: (iP >= 0 ? row[iP] : "").toString().trim()
    });
  }
  return Array.from(byCat.values());
}

function slugify(s) {
  return s.toLowerCase()
    .replace(/[čć]/g, "c").replace(/ž/g, "z").replace(/š/g, "s").replace(/đ/g, "dj")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/* ---- Boot ---- */
(async function init() {
  // Prepare shared scroll-reveal observer
  window.__menuIO = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        window.__menuIO.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });

  const fallback = window.__MENU_FALLBACK__ || [];
  renderMenu(fallback);

  const status = document.getElementById("menu-status");
  if (status) status.textContent = "";

  if (!MENU_SHEET_CSV_URL) return;

  try {
    const res = await fetch(MENU_SHEET_CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    const rows = parseCSV(text);
    const data = rowsToMenu(rows);
    if (data.length) renderMenu(data);
  } catch (err) {
    console.warn("Ne mogu da povučem Sheet, prikazan fallback:", err);
  }

  // Smooth-scroll za jump linkove sa offsetom za sticky bar
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (ev) => {
      const id = a.getAttribute('href');
      if (id.length > 1 && document.querySelector(id)) {
        ev.preventDefault();
        document.querySelector(id).scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
})();
