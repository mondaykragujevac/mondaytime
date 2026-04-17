/* meni.js — render menija i (opciono) povlačenje cena iz Google Sheet-a.
 *
 * KAKO POVEZATI GOOGLE SHEET:
 * 1. Napravi Sheet sa kolonama (prva vrsta zaglavlje): Category, Id, Icon, Name, Price
 *    - Category: naziv kategorije (npr. "Kafe & Topli napici")
 *    - Id: slug za anchor (npr. "kafe")
 *    - Icon: Font Awesome ime bez "fa-" (npr. "mug-hot")
 *    - Name: naziv stavke
 *    - Price: cena (samo broj ili prazno)
 * 2. File → Share → Publish to web → Sheet1 → CSV → Publish.
 * 3. Copy link i zalepi ga u MENU_SHEET_CSV_URL ispod.
 * 4. Deploy — cene se automatski povlače iz Sheet-a pri svakom učitavanju strane.
 */

const MENU_SHEET_CSV_URL = ""; // npr: "https://docs.google.com/spreadsheets/d/e/XXX/pub?output=csv"

/* ---- Renderer ---- */
function renderMenu(data) {
  const root = document.getElementById("menu-root");
  if (!root) return;

  const html = data.map(cat => {
    const items = (cat.items || []).map(it => {
      const price = (it.price || "").toString().trim();
      const priceHtml = price
        ? `<span class="price-value">${escapeHtml(price)}</span>`
        : `<span class="price-value text-base-content/40">—</span>`;
      return `
        <div class="price-row">
          <span class="price-name">${escapeHtml(it.name || "")}</span>
          <span class="price-dots"></span>
          ${priceHtml}
        </div>`;
    }).join("");
    const iconName = (cat.icon || "mug-hot").replace(/^fa-/, "");
    return `
      <section id="${escapeHtml(cat.id || "")}" class="mb-12">
        <h2 class="category-title">
          <i class="fa-solid fa-${escapeHtml(iconName)} text-brand mr-2"></i>
          ${escapeHtml(cat.category || "")}
        </h2>
        <div class="price-table">${items}</div>
      </section>
    `;
  }).join("");

  root.innerHTML = html;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

/* ---- CSV parser (Google Sheets CSV) ---- */
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
  const fallback = window.__MENU_FALLBACK__ || [];
  // Prvo odmah prikaži fallback (ne čeka fetch)
  renderMenu(fallback);

  const status = document.getElementById("menu-status");

  if (!MENU_SHEET_CSV_URL) {
    if (status) status.textContent = "";
    return;
  }

  try {
    const res = await fetch(MENU_SHEET_CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    const rows = parseCSV(text);
    const data = rowsToMenu(rows);
    if (data.length) {
      renderMenu(data);
      if (status) status.textContent = "";
    } else if (status) {
      status.textContent = "Napomena: Sheet nema validne podatke, prikazana je statička verzija.";
    }
  } catch (err) {
    console.warn("Ne mogu da povučem Sheet, prikazan fallback:", err);
    if (status) status.textContent = "";
  }
})();
