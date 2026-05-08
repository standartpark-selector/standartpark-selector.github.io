// Основные расчёты связанные с графиками и построением кривых
import { normNum, coeff, evalPoly, modelHash, listNums } from "./utils.js";
import { IMAGES } from "../data/assets.js";

export function makeSyntheticCurve(row, p) {
  const seed = modelHash(p.model || "pump");
  const qNom = Math.max(0.1, p.flow_m3h || normNum(row.Q) || 10);
  const hNom = Math.max(0.1, p.head_m || normNum(row.H) || 10);
  const qMax = Math.max(qNom * 1.65, qNom + 1);
  const hShut = hNom * (1.1 + 0.32 * seed);
  const exp = 1.55 + 0.9 * ((seed * 7) % 1);
  const tail = 0.04 + 0.14 * ((seed * 13) % 1);
  const pts = [];
  for (let i = 0; i <= 80; i++) {
    const q = (qMax * i) / 80;
    const r = q / qMax;
    let h = hShut * (1 - Math.pow(r, exp)) + hNom * tail * (1 - r);
    const nominalCorrection =
      hNom /
      (hShut * (1 - Math.pow(qNom / qMax, exp)) +
        hNom * tail * (1 - qNom / qMax));
    h *= nominalCorrection;
    const pwr = Math.max(
      0.05,
      (p.power_kw || 0) *
        (0.72 + 0.58 * r + 0.1 * Math.sin(r * Math.PI + seed)),
    );
    const eta = Math.max(
      0,
      Math.min(
        0.88,
        (p.efficiency || 0.52) * Math.sin(Math.PI * Math.min(1, r)) * 1.35,
      ),
    );
    pts.push({ q, h: Math.max(0, h), p: pwr, i: p.current_a || 0, eta });
  }
  return pts;
}

export function genCurve(row, p) {
  const qList = listNums(
      row.curve_q || row.curve_flow || row.curve_flow_m3h || row.points_q,
    ),
    hList = listNums(
      row.curve_h || row.curve_head || row.curve_head_m || row.points_h,
    );
  let pts = [];
  if (qList.length >= 2 && hList.length >= 2) {
    const pList = listNums(
        row.curve_p || row.curve_power || row.curve_power_kw || row.points_p,
      ),
      iList = listNums(
        row.curve_i || row.curve_current || row.curve_current_a || row.points_i,
      ),
      eList = listNums(
        row.curve_eta ||
          row.curve_eff ||
          row.curve_efficiency ||
          row.curve_efficiency_pct ||
          row.points_eta,
      );
    for (let i = 0; i < Math.min(qList.length, hList.length); i++) {
      let eta = eList[i] || 0;
      if (eta > 1) eta /= 100;
      pts.push({
        q: qList[i],
        h: hList[i],
        p: Math.max(0, pList[i] || 0),
        i: Math.max(0, iList[i] || 0),
        eta: Math.max(0, Math.min(1, eta)),
      });
    }
    pts = pts.filter((x) => x.q >= 0 && x.h >= 0).sort((a, b) => a.q - b.q);
  } else {
    const hc = coeff(row, "curve_h");
    if (hc.some((x) => x !== 0)) {
      const pc = coeff(row, "curve_p"),
        ic = coeff(row, "curve_i"),
        ec = coeff(row, "curve_eta").some((x) => x !== 0)
          ? coeff(row, "curve_eta")
          : coeff(row, "curve_efficiency");
      let qMin = Math.max(0, normNum(row.curve_q_min)),
        qMax = normNum(row.curve_q_max);
      if (qMax <= qMin + 1e-6)
        qMax =
          p.flow_m3h > 0
            ? p.flow_m3h * 1.8
            : qMin + Math.max(1, Math.abs(p.flow_m3h));
      const N = Math.max(
        40,
        Math.min(220, Math.round(normNum(row.curve_points) || 80)),
      );
      if (qMin > 1e-6) {
        let eta = evalPoly(ec, 0);
        if (eta > 1) eta /= 100;
        pts.push({
          q: 0,
          h: Math.max(0, evalPoly(hc, 0)),
          p: Math.max(0, evalPoly(pc, 0)),
          i: Math.max(0, evalPoly(ic, 0)),
          eta: Math.max(0, Math.min(1, eta)),
        });
      }
      for (let n = 0; n <= N; n++) {
        let q = qMin + ((qMax - qMin) * n) / N,
          eta = evalPoly(ec, q);
        if (eta > 1) eta /= 100;
        pts.push({
          q,
          h: Math.max(0, evalPoly(hc, q)),
          p: Math.max(0, evalPoly(pc, q)),
          i: Math.max(0, evalPoly(ic, q)),
          eta: Math.max(0, Math.min(1, eta)),
        });
      }
    }
  }
  pts = pts.filter(
    (x, i, a) =>
      Number.isFinite(x.q) &&
      Number.isFinite(x.h) &&
      x.q >= 0 &&
      x.h >= 0 &&
      (i === 0 || Math.abs(x.q - a[i - 1].q) > 1e-9),
  );
  const hSpread = pts.length
    ? Math.max(...pts.map((x) => x.h)) - Math.min(...pts.map((x) => x.h))
    : 0;
  const qSpread = pts.length
    ? Math.max(...pts.map((x) => x.q)) - Math.min(...pts.map((x) => x.q))
    : 0;
  if (pts.length < 2 || hSpread < 0.01 || qSpread < 0.01) {
    pts = makeSyntheticCurve(row, p);
    p.curve_source = "расчётная по номиналу";
  } else {
    p.curve_source = "CSV curve_h/curve_p";
  }
  // Сглаживание КПД: убираем «зуб» от кубического полинома —
  // оставляем единственный пик с монотонным ростом до него и спадом после.
  if (pts.length >= 3) {
    let peakIdx = 0;
    for (let i = 1; i < pts.length; i++)
      if ((pts[i].eta || 0) > (pts[peakIdx].eta || 0)) peakIdx = i;
    for (let i = peakIdx - 1; i >= 0; i--)
      if (pts[i].eta > pts[i + 1].eta) pts[i].eta = pts[i + 1].eta;
    for (let i = peakIdx + 1; i < pts.length; i++)
      if (pts[i].eta > pts[i - 1].eta) pts[i].eta = pts[i - 1].eta;
  }
  return pts;
}

export function seriesOf(model) {
  const m = String(model || "").match(/\d*([A-Z]+)/);
  return m ? m[1] : "";
}

export function makePump(row) {
  const p = {
    raw: row,
    model: row.Model || "",
    series: row.series || seriesOf(row.Model),
    flow_m3h: normNum(row.Q),
    head_m: normNum(row.H),
    power_kw: normNum(row.kW),
    temperature_c: normNum(row.T),
    suction_diam_mm: normNum(row.Dvs),
    discharge_diam_mm: normNum(row.Dn),
    efficiency: normNum(row.Efficiency_pct) / 100,
    current_a: normNum(row.I_nom_A || row.motor_current_a),
  };
  p.curve = genCurve(row, p);
  return p;
}

export function interp(p, q) {
  const c = p.curve || [];
  if (!c.length)
    return {
      q: p.flow_m3h,
      h: p.head_m,
      p: p.power_kw,
      i: p.current_a,
      eta: p.efficiency,
    };
  if (q <= c[0].q) return { ...c[0] };
  if (q >= c[c.length - 1].q) return { ...c[c.length - 1] };
  for (let i = 1; i < c.length; i++)
    if (q <= c[i].q) {
      const a = c[i - 1],
        b = c[i],
        t = (q - a.q) / (b.q - a.q || 1);
      return {
        q,
        h: a.h + (b.h - a.h) * t,
        p: a.p + (b.p - a.p) * t,
        i: a.i + (b.i - a.i) * t,
        eta: a.eta + (b.eta - a.eta) * t,
      };
    }
  return { ...c[c.length - 1] };
}

export function opMetrics(p, q, h, sh, n) {
  const reqSingle = q > 0 ? q / n : 0;
  const op =
    q > 0 && h > 0 ? findOP(p, reqSingle, h, sh) : interp(p, p.flow_m3h);
  const actualQ = op.q * n;
  const dq = q > 0 ? Math.abs(actualQ - q) / q : 0;
  const dh = h > 0 ? Math.abs(op.h - h) / h : 0;
  const nomQ = q > 0 ? Math.abs(p.flow_m3h * n - q) / q : 0;
  const nomH = h > 0 ? Math.abs(p.head_m - h) / h : 0;
  const score = q > 0 && h > 0 ? Math.hypot(dq, dh) : q > 0 ? nomQ : nomH;
  return { op, actualQ, dq, dh, nomQ, nomH, score };
}

export function findOP(p, reqQ, reqH, staticH) {
  const c = p.curve || [];
  if (c.length < 2)
    return {
      q: p.flow_m3h,
      h: p.head_m,
      p: p.power_kw,
      i: p.current_a,
      eta: p.efficiency,
    };
  if (reqQ <= 0 || reqH <= 0) {
    const target = Math.max(0, staticH || 0);
    for (let i = 0; i < c.length; i++) {
      if (c[i].h <= target) {
        if (i === 0) return { ...c[0] };
        const h0 = c[i - 1].h,
          h1 = c[i].h,
          dh = h0 - h1,
          q0 = c[i - 1].q,
          q1 = c[i].q;
        const qCross =
          Math.abs(dh) > 1e-9 ? q0 + ((q1 - q0) * (h0 - target)) / dh : q0;
        return interp(p, qCross);
      }
    }
    return { ...c[c.length - 1] };
  }
  const k = (reqH - staticH) / (reqQ * reqQ);
  const Hsys = (Q) => staticH + k * Q * Q;
  const F = (Q) => interp(p, Q).h - Hsys(Q);
  const qMin = 0;
  let qMax = c[c.length - 1].q;
  if (reqQ * 1.05 > qMax) qMax = reqQ * 1.05;
  const N = 300;
  let prevQ = qMin,
    prevF = F(prevQ),
    bestQ = prevQ,
    bestAbs = Math.abs(prevF),
    foundA = NaN,
    foundB = NaN;
  for (let i = 1; i <= N; i++) {
    const Q = qMin + (qMax - qMin) * (i / N),
      val = F(Q),
      abs = Math.abs(val);
    if (abs < bestAbs) {
      bestAbs = abs;
      bestQ = Q;
    }
    if (prevF * val <= 0) {
      foundA = prevQ;
      foundB = Q;
      break;
    }
    prevQ = Q;
    prevF = val;
  }
  let Qstar = bestQ;
  if (Number.isFinite(foundA) && Number.isFinite(foundB) && foundA !== foundB) {
    let a = foundA,
      b = foundB,
      fa = F(a);
    for (let i = 0; i < 50; i++) {
      const m = 0.5 * (a + b),
        fm = F(m);
      if (fa * fm <= 0) b = m;
      else {
        a = m;
        fa = F(a);
      }
    }
    Qstar = 0.5 * (a + b);
  }
  return interp(p, Qstar);
}

export function imageFor(kind, p) {
  const s = (p.series || seriesOf(p.model) || "").toUpperCase(),
    d = p.raw.drawing || s,
    names = [
      p.model + ".png",
      p.model + ".jpg",
      d + ".png",
      d + ".jpg",
      s + ".png",
      s + ".jpg",
      "WQ_2P.png",
      "WQ_46P.png",
    ],
    bank = IMAGES[kind] || {};
  for (const n of names) if (bank[n]) return bank[n];
  return "";
}
