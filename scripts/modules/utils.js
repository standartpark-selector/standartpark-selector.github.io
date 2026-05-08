// Тут будут вспомогательные функции, которые яляются утилитами
// Ещё небольшие вычисления

// Оч важная хреновина. Пусть будет пока тут 
export const $ = (id) => document.getElementById(id);

export function normNum(v) {
  if (v == null) return 0;
  let s = String(v)
    .replace(",", ".")
    .replace(/[^0-9.\-+eE]/g, "");
  let n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function parseCSV(txt) {
  const lines = txt
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((x) => x.trim());
  const headers = lines
    .shift()
    .split(";")
    .map((h) => h.trim());
  return lines.map((line) => {
    const cols = line.split(";");
    const o = {};
    headers.forEach((h, i) => (o[h] = (cols[i] ?? "").trim()));
    return o;
  });
}

export function coeff(row, prefix) {
  return [0, 1, 2, 3].map((i) => normNum(row[prefix + i]));
}

export function evalPoly(c, x) {
  return ((c[3] * x + c[2]) * x + c[1]) * x + c[0];
}

export function listNums(raw) {
  if (!raw) return [];
  return String(raw)
    .trim()
    .split(raw.includes("|") ? "|" : ",")
    .map(normNum)
    .filter(Number.isFinite);
}

export function modelHash(s) {
  let h = 2166136261;
  for (let i = 0; i < String(s).length; i++) {
    h ^= String(s).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function esc(v) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        m
      ],
  );
}

export function fmt(x, d = 2) {
  return Number.isFinite(+x) && +x !== 0 ? (+x).toFixed(d) : "—";
}

export function pct(x) {
  return Number.isFinite(+x) ? (+x * 100).toFixed(1) + " %" : "—";
}