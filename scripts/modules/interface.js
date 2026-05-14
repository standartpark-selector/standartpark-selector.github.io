// Тут всё что связвно с интерфейсом на сайте м данными для отображения
import { reportInfo } from "../data/config.js";
import { $, normNum, esc, fmt } from "./utils.js";
import { selected } from "../index.js";
import { IMAGES } from "../data/assets.js";
import { interp, findOP, imageFor, seriesOf } from "./calculates.js";
import { SERIES_GROUPS } from "../data/catalog.js";
export function loadReportInfo() {
  try {
    const saved = localStorage.getItem("pumpSelector.reportInfo");
    if (saved) reportInfo = { ...reportInfo, ...JSON.parse(saved) };
  } catch (e) {}
}

export function syncReportForm() {
  for (const k of [
    "manager",
    "requestNumber",
    "systemName",
    "projectName",
    "clientName",
    "contacts",
    "cableLength",
  ]) {
    const el = $("ri_" + k);
    if (el) el.value = reportInfo[k] || "";
  }
}

export function readReportForm() {
  for (const k of [
    "manager",
    "requestNumber",
    "systemName",
    "projectName",
    "clientName",
    "contacts",
    "cableLength",
  ]) {
    const el = $("ri_" + k);
    if (el) reportInfo[k] = el.value.trim();
  }
  localStorage.setItem("pumpSelector.reportInfo", JSON.stringify(reportInfo));
  renderReportInfoBlock();
}

export function openReportInfo() {
  syncReportForm();
  $("reportModal").classList.add("open");
}

export function closeReportInfo() {
  readReportForm();
  $("reportModal").classList.remove("open");
}

export function renderReportInfoBlock() {
  const el = $("reportInfoBlock");
  if (!el) return;
  const sh = normNum($("staticHead")?.value || 0);
  const cable =
    reportInfo.cableLength ||
    (selected && selected.raw && selected.raw.inst_cable_length_m) ||
    "";
  el.innerHTML =
    '<h3>Информация для отчёта</h3><div class="reportGrid"><div><b>Менеджер</b>' +
    esc(reportInfo.manager || "—") +
    "</div><div><b>Номер запроса</b>" +
    esc(reportInfo.requestNumber || "—") +
    "</div><div><b>Система</b>" +
    esc(reportInfo.systemName || "—") +
    "</div><div><b>Проект / объект</b>" +
    esc(reportInfo.projectName || "—") +
    "</div><div><b>Клиент</b>" +
    esc(reportInfo.clientName || "—") +
    "</div><div><b>Контакты</b>" +
    esc(reportInfo.contacts || "—") +
    "</div><div><b>Статический напор</b>" +
    fmt(sh, 1) +
    " м</div><div><b>Длина кабеля</b>" +
    esc(cable || "—") +
    (cable ? " м" : "") +
    "</div></div>";
}

export function downloadReportTemplate() {
  readReportForm();
  const blob = new Blob([JSON.stringify(reportInfo, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "pump-report-template.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function loadReportTemplateFile(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      reportInfo = { ...reportInfo, ...JSON.parse(r.result) };
      syncReportForm();
      readReportForm();
    } catch (e) {
      alert("Не удалось прочитать JSON-шаблон отчёта");
    }
  };
  r.readAsText(file);
}

export function prVal(v, suf = "") {
  return v !== undefined &&
    v !== null &&
    String(v).trim() !== "" &&
    String(v) !== "0"
    ? esc(v) + suf
    : "—";
}

export function prNum(v, d = 0, suf = "") {
  const n = normNum(v);
  return n ? fmt(n, d) + suf : "—";
}

export function prHeader(p, page, total) {
  const r = p && p.raw ? p.raw : {},
    date = new Date().toLocaleDateString("ru-RU");
  return (
    '<div class="pr-page-no">3-' +
    page +
    '</div><div class="pr-header"><div class="pr-logo">' +
    (IMAGES.logo ? '<img src="' + IMAGES.logo + '">' : "") +
    '</div><div class="pr-title"><div><div class="pr-muted" style="font-size:9px;margin-bottom:8mm">информация об изделии</div>' +
    esc(p ? p.model : "—") +
    '</div></div><div class="pr-meta"><div>завод-изготовитель</div><div>' +
    esc(r.manufacturer || "Yoking pump industry CO., LTD") +
    "</div><div>дата</div><div>" +
    date +
    "</div><div>менеджер</div><div>" +
    esc(reportInfo.manager || "") +
    "</div><div>номер запроса</div><div>" +
    esc(reportInfo.requestNumber || "") +
    "</div><div>система</div><div>" +
    esc(reportInfo.systemName || "") +
    "</div><div>проект / объект</div><div>" +
    esc(reportInfo.projectName || "") +
    "</div></div></div>"
  );
}

export function prRows(title, rows) {
  return (
    '<div class="pr-section-title">' +
    esc(title) +
    '</div><table class="pr-table">' +
    rows
      .map((x) => "<tr><td>" + esc(x[0]) + "</td><td>" + x[1] + "</td></tr>")
      .join("") +
    "</table>"
  );
}

export function drawParallelCanvas(p, n, q, h, sh) {
  const COLORS = ["#1769e0", "#d92d20", "#16a34a", "#ca8a04", "#9333ea", "#0891b2", "#be185d"];
  const canvas = document.createElement("canvas");
  canvas.width = 1050;
  canvas.height = 660;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const L = 82, T = 34, R = 34, B = 110;
  const W = canvas.width - L - R, H = canvas.height - T - B;

  function ln(x1, y1, x2, y2) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function dot(x, y, fill, stroke, r) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
  }
  function niceAxis(dataMax) {
    if (!Number.isFinite(dataMax) || dataMax <= 0) return { max: 10, step: 1 };
    const rough = dataMax / 8;
    const exp = Math.pow(10, Math.floor(Math.log10(rough)));
    const f = rough / exp;
    const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
    return { max: Math.ceil(dataMax / step) * step, step };
  }
  function pumpLabel(k) {
    if (k === 1) return "1 насос";
    if (k >= 2 && k <= 4) return k + " насоса";
    return k + " насосов";
  }

  const curve = p.curve.filter(pt => Number.isFinite(pt.q) && Number.isFinite(pt.h));
  const qMaxRaw = Math.max(...curve.map(x => x.q * n), (p.flow_m3h || 0) * n, 1);
  const hMaxRaw = Math.max(...curve.map(x => x.h), p.head_m || 0, 1);
  const { max: maxQ, step: qStep } = niceAxis(qMaxRaw);
  const { max: maxH, step: hStep } = niceAxis(hMaxRaw * 1.05);

  const X = (qv) => L + (qv / maxQ) * W;
  const Y = (v)  => T + H - (v  / maxH) * H;

  ctx.strokeStyle = "#d0d5dd"; ctx.lineWidth = 1;
  for (let qv = 0; qv <= maxQ + 1e-9; qv += qStep) ln(X(qv), T, X(qv), T + H);
  for (let hv = 0; hv <= maxH + 1e-9; hv += hStep) ln(L, Y(hv), L + W, Y(hv));

  ctx.strokeStyle = "#344054"; ctx.lineWidth = 1.6;
  ln(L, T, L, T + H); ln(L, T + H, L + W, T + H);

  ctx.fillStyle = "#475467"; ctx.font = "14px Arial";
  ctx.fillText("H(m)", 4, 25);
  ctx.fillText("Q(м³/ч)", L + W - 60, T + H + 22);

  ctx.fillStyle = "#667085"; ctx.font = "11px Arial";
  for (let qv = 0; qv <= maxQ + 1e-9; qv += qStep)
    ctx.fillText(qv.toFixed(maxQ < 20 ? 1 : 0), X(qv) - 10, T + H + 16);
  for (let hv = 0; hv <= maxH + 1e-9; hv += hStep)
    ctx.fillText(hv.toFixed(maxH < 20 ? 1 : 0), 28, Y(hv) + 4);

  ctx.fillStyle = "#101828"; ctx.font = "bold 13px Arial";
  ctx.fillText("Параллельная работа насосов", L + 10, T + 22);

  const endPoints = [];
  for (let k = 1; k <= n; k++) {
    const color = COLORS[(k - 1) % COLORS.length];
    ctx.beginPath();
    curve.forEach((pt, i) => {
      const x = X(pt.q * k), y = Y(pt.h);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = k === n ? 3.2 : 2.4;
    ctx.setLineDash([]);
    ctx.stroke();
    const last = curve[curve.length - 1];
    if (last) endPoints.push({ k, color, x: X(last.q * k), y: Y(last.h) });
  }
  endPoints.forEach((ep, idx) => {
    dot(ep.x, ep.y, "#fff", ep.color, 4);
    ctx.fillStyle = ep.color;
    ctx.font = "bold 12px Arial";
    const offY = (idx % 2 === 0 ? -10 : 18);
    const tx = Math.min(ep.x + 8, L + W - 80);
    ctx.fillText(pumpLabel(ep.k), tx, ep.y + offY);
  });

  if (q > 0 && h > 0 && h > sh) {
    const k = (h - sh) / (q * q);
    ctx.beginPath();
    let first = true;
    for (let i = 0; i <= 240; i++) {
      const qv = (maxQ * i) / 240, hv = sh + k * qv * qv;
      if (hv > maxH * 1.04) break;
      first ? (ctx.moveTo(X(qv), Y(hv)), first = false) : ctx.lineTo(X(qv), Y(hv));
    }
    ctx.setLineDash([8, 6]); ctx.strokeStyle = "#d92d20"; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);

    const op = findOP(p, q / n, h, sh), gq = op.q * n;
    ctx.strokeStyle = "#d92d20"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ln(L, Y(op.h), X(gq), Y(op.h));
    ln(X(gq), Y(op.h), X(gq), T + H);
    ctx.setLineDash([]);
    dot(X(gq), Y(op.h), "#f04438", "#b42318", 7);
    ctx.fillStyle = "#101828"; ctx.font = "bold 12px Arial";
    ctx.fillText("Q=" + gq.toFixed(1) + "  H=" + op.h.toFixed(1),
      Math.min(X(gq) + 9, L + W - 140), Math.max(T + 30, Y(op.h) - 9));
  }

  ctx.fillStyle = "#101828"; ctx.font = "bold 14px Arial";
  ctx.fillText(p.model, L + W - 200, T + 22);

  const legendY = T + H + 50;
  const slotW = Math.min(160, W / n);
  for (let k = 1; k <= n; k++) {
    const color = COLORS[(k - 1) % COLORS.length];
    const lx = L + (k - 1) * slotW;
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(lx, legendY); ctx.lineTo(lx + 28, legendY); ctx.stroke();
    ctx.fillStyle = "#101828"; ctx.font = "12px Arial";
    ctx.fillText(pumpLabel(k), lx + 33, legendY + 4);
  }

  return canvas.toDataURL("image/png");
}

export function buildPrintReport() {
  readReportForm();
  const box = $("printReport");
  if (!box) return;
  if (!selected) {
    box.innerHTML = '<div class="pr-page"><h2>Насос не выбран</h2></div>';
    return;
  }
  const p = selected,
    r = p.raw || {},
    q = normNum($("q").value) || p.flow_m3h,
    h = normNum($("h").value) || p.head_m,
    sh = normNum($("staticHead").value),
    n = Math.max(1, Math.round(normNum($("numPumps").value) || 1)),
    op = q && h ? findOP(p, q / n, h, sh) : interp(p, p.flow_m3h);
  const photo = imageFor("photos", p),
    drawing = imageFor("drawings", p),
    chart = $("chart").toDataURL("image/png");
  const series = (p.series || seriesOf(p.model) || "").toUpperCase();
  const showWiring = !["WQ", "WQD", "WQK", "DGWQ", "DGWQD"].includes(series);
  const SERIES_DESC = {
    WQ:    "Погружной канализационный электрический насос WQ(D)/WQ состоит из насоса, торцевых уплотнений и двигателя. В верхней части расположен асинхронный однофазный электродвигатель в герметичном корпусе. В нижней части расположен сам насос с незасоряющимся рабочим колесом. Двойное торцевое уплотнение расположено между насосом и электродвигателем, в качестве неподвижной части используется О-образное кольцо из маслостойкой резины. Все элементы соединяются винтами из нержавеющей стали. Насосы WQ(D)/WQ созданы для стационарной установки на автоматической трубной муфте в погружённом состоянии. В случае необходимости могут быть использованы как аварийные насосы. Насосы WQ(D)/WQ могут использоваться со взмучивающим устройством JY (опция). Насосы WQ(D)/WQ могут использоваться в непогружённом состоянии благодаря наличию встроенной рубашки охлаждения С (опция).",
    WQD:   "Погружной канализационный электрический насос WQ(D)/WQ состоит из насоса, торцевых уплотнений и двигателя. В верхней части расположен асинхронный однофазный электродвигатель в герметичном корпусе. В нижней части расположен сам насос с незасоряющимся рабочим колесом. Двойное торцевое уплотнение расположено между насосом и электродвигателем, в качестве неподвижной части используется О-образное кольцо из маслостойкой резины. Все элементы соединяются винтами из нержавеющей стали. Насосы WQ(D)/WQ созданы для стационарной установки на автоматической трубной муфте в погружённом состоянии. В случае необходимости могут быть использованы как аварийные насосы. Насосы WQ(D)/WQ могут использоваться со взмучивающим устройством JY (опция). Насосы WQ(D)/WQ могут использоваться в непогружённом состоянии благодаря наличию встроенной рубашки охлаждения С (опция). Двухполюсное исполнение (2P).",
    WQK:   "Погружной канализационный насос с режущим механизмом. Измельчает волокнистые включения перед перекачкой. IP68.",
    DGWQ:  "Погружной дренажный насос. Перекачивает чистую воду и воду с небольшим содержанием примесей. Применяется в дренажных системах, подвалах, колодцах.",
    DGWQD: "Погружной дренажный насос (двухполюсное исполнение). Компактный, для дренажных систем и затопленных помещений.",
    IRG:   "Одноступенчатый вертикальный инлайн-насос. Фланцевое подключение в разрыв трубопровода. Для систем водоснабжения, отопления и промышленного водооборота. Стандарт GB/T 5657.",
    ISW:   "Горизонтальный одноступенчатый инлайн-насос. Аналог IRG, горизонтальное расположение. Для систем отопления, водоснабжения и кондиционирования.",
    ISG:   "Вертикальный одноступенчатый инлайн-насос повышенной производительности. Для систем водоснабжения и промышленного применения.",
    TD:    "Вертикальный одноступенчатый инлайн-насос компактной конструкции. Прямое фланцевое соединение с трубопроводом. Для систем HVAC, водоснабжения и промышленного применения.",
    CDL:   "Многоступенчатый вертикальный центробежный насос (нержавеющий рабочий орган). Для систем водоснабжения, пожаротушения, повышения давления.",
    CDLF:  "Многоступенчатый вертикальный центробежный насос (полностью из нержавеющей стали). Для пищевой промышленности, систем водоснабжения и повышения давления.",
    YST:   "Погружной трубчатый насос для скважин. Узкий корпус для вертикальных скважин. Для водоснабжения из глубоких скважин.",
    ZW:    "Самовсасывающий канализационный насос. Не требует заливки перед пуском. Перекачивает сточные воды с твёрдыми включениями без подтопления насоса.",
    MHI:   "Многоступенчатый горизонтальный насос с нержавеющим рабочим органом. Для бытового водоснабжения, орошения и систем повышения давления.",
    CMI:   "Поверхностный центробежный насос. Для промышленных и бытовых систем водоснабжения.",
  };
  const SUBMERSIBLE = new Set(["WQ","WQD","WQK","DGWQ","DGWQD"]);
  const seriesDesc = SERIES_DESC[series] || "";
  let couplingImg = "";
  let dn = "";
  if (SUBMERSIBLE.has(series)) {
    const dnMatch = p.model.match(/^(\d+)/);
    if (dnMatch) {
      dn = dnMatch[1];
      const dnKey = "DN" + dn + ".png";
      couplingImg = (IMAGES.couplings && IMAGES.couplings[dnKey]) || "";
    }
  }
  const total = (n > 1 ? 3 : 2) + 1;
  let pages = "";
  pages +=
    '<section class="pr-page">' +
    prHeader(p, 1, total) +
    '<div class="pr-top-grid"><div><div class="pr-product">Номер изделия:</div><div class="pr-photo">' +
    (photo ? '<img src="' + photo + '">' : "") +
    '</div></div><div class="pr-cell"><b>' +
    esc(p.model) +
    '</b><p class="pr-warning">Внимание:<br>Изображение продукта может отличаться от самого продукта</p></div><div class="pr-cell pr-desc">' +
    (seriesDesc
      ? '<p class="pr-series-desc">' + esc(seriesDesc) + "</p>"
      : '<b>Центробежный насос</b><div>Центробежный насос производства ' + esc(r.manufacturer || "Yoking pump industry CO., LTD") + ".</div>") +
    '</div></div>' +
    prRows("Заданная рабочая точка", [
      [
        "Расход, м³/ч (л/с)",
        esc(fmt(q, 1)) + " (" + esc(fmt(q / 3.6, 1)) + ")",
      ],
      ["Напор, м", esc(fmt(h, 1))],
    ]) +
    prRows("Фактическая рабочая точка", [
      [
        "Расход, м³/ч (л/с)",
        esc(fmt(op.q * n, 1)) + " (" + esc(fmt((op.q * n) / 3.6, 1)) + ")",
      ],
      ["Напор, м", esc(fmt(op.h, 1))],
      ["Ток, А", op.i ? prNum(op.i, 1) : "—"],
      ["КПД, %", op.eta ? prNum(op.eta * 100, 1) : "—"],
    ]) +
    prRows("Материалы", [
      ["Рабочее колесо", prVal(r.mat_impeller)],
      ["Вход и выход", prVal(r.mat_inlet_outlet)],
      ["Вал", prVal(r.mat_shaft)],
      ["Подшипник", prVal(r.mat_bearing)],
      ["Обмотка мотора", prVal(r.mat_winding)],
    ]) +
    prRows("Установка", [
      ["Способ установки", prVal(r.inst_method)],
      ["Макс. допустимое давление (бар)", prVal(r.inst_max_pressure_bar)],
      ["Тип соединения", prVal(r.inst_connection_type)],
      ["Размер напорного патрубка", prVal(r.inst_outlet_size_mm)],
    ]) +
    prRows("Допустимые значения", [
      [
        "MAX температура жидкости (°C)",
        prVal(r.avg_temp_min_c) + " ~ " + prVal(r.avg_temp_max_c),
      ],
      ["MAX температура окружающей среды (°C)", prVal(r.avg_max_temp_c)],
      ["Жидкости", prVal(r.avg_liquid)],
    ]) +
    prRows("Мотор", [
      ["Количество фаз мотора", prVal(r.motor_phases)],
      ["Класс защиты", prVal(r.motor_ip_class)],
      ["Класс изоляции", prVal(r.motor_insulation)],
      ["Мощность мотора", prNum(p.power_kw, 1, " кВт")],
      ["Номинальный ток (А)", prNum(p.current_a, 1)],
      ["Частота мощности", prVal(r.motor_freq_hz, " Гц")],
      ["Номинальная скорость (об/мин)", prVal(r.motor_rpm)],
      ["Допустимое напряжение (В)", prVal(r.motor_voltage_v)],
      ["Защита", prVal(r.motor_protection)],
      ["Кабель, n×мм²", prVal(r.motor_cable) + (r.motor_cable ? " (стандартная длина 8 м, опциональное увеличение указано в КП)" : "")],
    ]) +
    prRows("Уплотнение", [["Торцевое уплотнение", prVal(r.seal_type)]]) +
    prRows("Дополнительно", [
      ["Вес насоса", prVal(r.add_weight_kg, " кг")],
      ["Режим работы насоса", prVal(r.add_duty_type)],
    ]) +
    "</section>";
  pages +=
    '<section class="pr-page">' +
    prHeader(p, 2, total) +
    '<h1 class="pr-h1">Гидравлические кривые / Описание</h1><img class="pr-chart-img" src="' +
    chart +
    '"><div class="pr-workpoint"><b>Условная рабочая точка:</b><br>Q = ' +
    esc(fmt(q, 1)) +
    " м³/ч (" +
    esc(fmt(q / 3.6, 1)) +
    " л/с) &nbsp;&nbsp; H = " +
    esc(fmt(h, 1)) +
    " м</div></section>";
  if (n > 1) {
    const parallelChart = drawParallelCanvas(p, n, q, h, sh);
    pages +=
      '<section class="pr-page">' +
      prHeader(p, 3, total) +
      '<h1 class="pr-h1">Параллельная работа насосов</h1><img class="pr-chart-wide" src="' +
      parallelChart +
      '"><div class="pr-workpoint"><b>Рабочих насосов:</b> ' +
      n +
      " &nbsp;&nbsp; <b>Q общий:</b> " +
      esc(fmt(q, 1)) +
      " м³/ч &nbsp;&nbsp; <b>H:</b> " +
      esc(fmt(h, 1)) +
      ' м</div><div class="pr-parallel-note">Компоновка страницы выполнена под паспортный отчёт. Алгоритм построения кривых не изменён.</div></section>';
  }
  const dimRows = [
    ["Подача Q", esc(fmt(q, 1)) + " м³/ч"],
    ["Напор H", esc(fmt(h, 1)) + " м"],
    ["Мощность", prNum(p.power_kw, 1, " кВт")],
    ["B — ширина патрубка", prVal(r.B, " мм")],
    ["H — полная высота", prVal(r["H_габарит"] || r.H, " мм")],
    ["H1 — высота до патрубка", prVal(r.H1, " мм")],
    ["W — ширина основания", prVal(r.W, " мм")],
    ["D — диаметр патрубка", prVal(r.D || r.DN, " мм")],
    ["D1 — Ø окр. болтов", prVal(r.D1, " мм")],
    ["D2 — уплотн. проточка", prVal(r.D2, " мм")],
    ["D3 — Ø патрубка (DN)", prVal(r.D3 || r.DN_label)],
  ];
  pages +=
    '<section class="pr-page' + (couplingImg ? ' pr-page--coupling' : '') + '">' +
    prHeader(p, total, total) +
    '<h1 class="pr-h1">Размеры:</h1><div class="pr-dim-grid"><div class="pr-drawing">' +
    (drawing ? '<img src="' + drawing + '">' : "") +
    '</div><table class="pr-dim-table"><tr><th colspan="2">Габаритные размеры (мм)</th></tr>' +
    dimRows
      .slice(3, 8)
      .map((x) => "<tr><td>" + x[0] + "</td><td><b>" + x[1] + "</b></td></tr>")
      .join("") +
    '<tr><th colspan="2">Фланец патрубка (мм)</th></tr>' +
    dimRows
      .slice(8)
      .map((x) => "<tr><td>" + x[0] + "</td><td><b>" + x[1] + "</b></td></tr>")
      .join("") +
    "</table></div>" +
    (showWiring
      ? '<div class="pr-conn"><h3>Схема подключений:</h3><div class="pr-conn-grid"><div class="pr-conn-box">Y<span>«звезда» при мощности до 4 кВт</span></div><div class="pr-conn-box">△<span>«треугольник» при мощности от 5,5 кВт</span></div><div class="pr-conn-box">Y&nbsp;&nbsp;△<span>частотный преобразователь или плавный пуск</span></div></div></div>'
      : (couplingImg ? '<div class="pr-coupling"><h3>Чертёж муфты DN' + esc(dn) + ':</h3><img class="pr-coupling-img" src="' + couplingImg + '"></div>' : "")) +
    "</section>";
  box.innerHTML = pages;
}

export function buildSeries() {
  const box = $("seriesBox");
  box.innerHTML = "";
  for (const [g, arr] of Object.entries(SERIES_GROUPS)) {
    const d = document.createElement("div");
    d.className = "seriesGroup";
    d.innerHTML = "<b>" + g + "</b>";
    for (const s of arr)
      d.insertAdjacentHTML(
        "beforeend",
        '<label class="check"><input type="checkbox" value="' +
          s +
          '">' +
          s +
          "</label>",
      );
    box.appendChild(d);
  }
  // Change handler is wired up in index.js (where selectedSeries/applyFilter live)
}