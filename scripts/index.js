import { CSV_DATA } from "./data/catalog.js";
import { IMAGES } from "./data/assets.js";
import { TOL } from "./data/config.js";
import { $, normNum, parseCSV, coeff, fmt, pct } from "./modules/utils.js";
import {
  seriesOf,
  makePump,
  interp,
  opMetrics,
  findOP,
  imageFor
} from "./modules/calculates.js";
import {
  loadReportInfo,
  readReportForm,
  openReportInfo,
  closeReportInfo,
  renderReportInfoBlock,
  downloadReportTemplate,
  loadReportTemplateFile,
  buildPrintReport,
  buildSeries
} from "./modules/interface.js";

export let PUMPS = [];
export let filtered = [];
export let selected = null;
export let sortKey = "score";
export let sortDir = 1;
export let selectedSeries = new Set();

function init() {
  loadReportInfo();
  renderReportInfoBlock();
  $("logo").src = IMAGES.logo || "";
  PUMPS = parseCSV(CSV_DATA)
    .map(makePump)
    .filter((p) => p.model);
  buildSeries();
  bind();
  applyFilter();
  $("stats").textContent =
    "Загружено насосов: " +
    PUMPS.length +
    ". С реальными кривыми: " +
    PUMPS.filter((p) => p.curve.length >= 2).length +
    ".";
}

function bind() {
  ["q", "h", "staticHead", "numPumps"].forEach((id) =>
    $(id).addEventListener("input", debounce(applyFilter, 250)),
  );
  $("findBtn").onclick = applyFilter;
  $("clearBtn").onclick = () => {
    ["q", "h", "modelSearch"].forEach((id) => ($(id).value = ""));
    $("staticHead").value = 5;
    $("numPumps").value = 1;
    selectedSeries.clear();
    document
      .querySelectorAll("#seriesBox input")
      .forEach((x) => (x.checked = false));
    applyFilter();
  };
  $("reportInfoBtn").onclick = openReportInfo;
  $("saveReportInfo").onclick = closeReportInfo;
  $("closeReportInfo").onclick = closeReportInfo;
  $("saveTemplateBtn").onclick = downloadReportTemplate;
  $("loadTemplateBtn").onclick = () => $("templateFile").click();
  $("templateFile").addEventListener("change", (e) =>
    loadReportTemplateFile(e.target.files[0]),
  );
  $("reportModal").addEventListener("click", (e) => {
    if (e.target.id === "reportModal") closeReportInfo();
  });
  $("printBtn").onclick = () => {
    buildPrintReport();
    window.print();
  };
  $("modelSearch").addEventListener("input", debounce(applyFilter, 200));
  $("seriesSearch").addEventListener("input", (e) => {
    const v = e.target.value.toLowerCase();
    document
      .querySelectorAll(".seriesGroup")
      .forEach(
        (g) =>
          (g.style.display = g.textContent.toLowerCase().includes(v)
            ? "block"
            : "none"),
      );
  });
  $("allSeries").onclick = () => {
    document
      .querySelectorAll("#seriesBox input")
      .forEach((x) => (x.checked = true));
    selectedSeries = new Set(
      [...document.querySelectorAll("#seriesBox input")].map((x) => x.value),
    );
    applyFilter();
  };
  $("noneSeries").onclick = () => {
    document
      .querySelectorAll("#seriesBox input")
      .forEach((x) => (x.checked = false));
    selectedSeries.clear();
    applyFilter();
  };
  $("seriesBox").addEventListener("change", (e) => {
    if (e.target.matches('input[type="checkbox"]')) {
      selectedSeries = new Set(
        [...document.querySelectorAll("#seriesBox input:checked")].map(
          (x) => x.value,
        ),
      );
      applyFilter();
    }
  });
  document
    .querySelectorAll(".tab")
    .forEach((b) => (b.onclick = () => switchTab(b.dataset.tab)));
  document.querySelectorAll("th[data-sort]").forEach(
    (th) =>
      (th.onclick = () => {
        const k = th.dataset.sort;
        sortDir = sortKey === k ? -sortDir : 1;
        sortKey = k;
        renderTable();
      }),
  );
}










function switchTab(t) {
  document
    .querySelectorAll(".tab")
    .forEach((b) => b.classList.toggle("active", b.dataset.tab === t));
  ["hydro", "direct", "series"].forEach(
    (x) =>
      ($(x + "Tab").style.display =
        x === t ? (x === "series" ? "block" : "grid") : "none"),
  );
}
function debounce(fn, ms) {
  let t;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}
function applyFilter() {
  const q = normNum($("q").value),
    h = normNum($("h").value),
    sh = normNum($("staticHead").value),
    n = Math.max(1, Math.round(normNum($("numPumps").value) || 1)),
    query = $("modelSearch").value.trim().toLowerCase();
  filtered = [];
  let exact = 0,
    reserve = 0;
  for (const p0 of PUMPS) {
    const p = { ...p0 };
    if (
      query &&
      !p.model.toLowerCase().includes(query) &&
      !p.series.toLowerCase().includes(query)
    )
      continue;
    if (
      selectedSeries.size &&
      !selectedSeries.has(seriesOf(p.model)) &&
      !selectedSeries.has(p.series)
    )
      continue;
    let ok = true,
      hi = false,
      status = "Каталог",
      reason = "Без Q/H";
    const m = opMetrics(p, q, h, sh, n);
    p._op = m.op;
    p._actualQ = m.actualQ;
    p._dq = m.dq;
    p._dh = m.dh;
    p._score = m.score;
    p._nomQ = m.nomQ;
    p._nomH = m.nomH;
    if (query) {
      ok = true;
      if (q > 0 && h > 0) {
        hi = m.dq <= TOL.op && m.dh <= TOL.op;
        status = hi ? "Рабочая точка" : "По названию";
        reason = `ΔQ ${pct(m.dq)}, ΔH ${pct(m.dh)}`;
      } else {
        status = "По названию";
        reason = "Поиск по наименованию";
      }
    } else if (q > 0 && !h) {
      ok = p.flow_m3h > 0 && m.nomQ <= TOL.nomQ;
      hi = ok && m.nomQ <= TOL.hiQ;
      status = hi ? "Точное Q" : "По Q";
      reason = "Откл. Q " + pct(m.nomQ);
    } else if (h > 0 && !q) {
      ok = p.head_m > 0 && m.nomH <= TOL.nomH;
      hi = ok && m.nomH <= TOL.hiH;
      status = hi ? "Точное H" : "По H";
      reason = "Откл. H " + pct(m.nomH);
    } else if (q > 0 && h > 0) {
      const reqSingle = q / n;
      const cv = p.curve || [];
      let qInRange = false,
        hAtQ = 0;
      if (cv.length >= 2) {
        qInRange =
          reqSingle >= cv[0].q - 1e-6 &&
          reqSingle <= cv[cv.length - 1].q + 1e-6;
        if (qInRange) hAtQ = interp(p, reqSingle).h;
      }
      const canDeliver = qInRange && hAtQ >= h * 0.98;
      if (!canDeliver) ok = false;
      else {
        hi = m.dq <= TOL.op && m.dh <= TOL.op;
        ok = true;
        status = hi ? "Рабочая точка" : "Резерв";
        reason = hi
          ? `ОП: ΔQ ${pct(m.dq)}, ΔH ${pct(m.dh)}`
          : `Кривая: H(${q.toFixed(1)})≈${hAtQ.toFixed(1)} м, ном. ΔQ ${pct(m.nomQ)}`;
      }
      if (h <= sh) {
        status = "Проверь Hст";
        reason = "Полный напор не выше статического";
      }
    }
    if (ok) {
      p.highlight = hi;
      p._status = status;
      p._reason = reason;
      filtered.push(p);
      if (hi) exact++;
      else reserve++;
    }
  }
  filtered.sort((a, b) => (a._score || 0) - (b._score || 0));
  renderHealth(q, h, sh, n, exact, reserve);
  renderTable();
  selectPump(filtered[0] || null);
}
function renderHealth(q, h, sh, n, exact, reserve) {
  const el = $("healthCard");
  if (!el) return;
  const total = filtered.length,
    curves = PUMPS.filter((p) => p.curve.length >= 2).length;
  let warn = "";
  if (q > 0 && h > 0 && h <= sh)
    warn =
      '<span class="pill bad">H должен быть выше статического напора</span>';
  el.innerHTML = `<div class="metric"><b>${total}</b><span>результатов</span></div><div class="metric"><b>${exact}</b><span>точных по ОП</span></div><div class="metric"><b>${curves}</b><span>кривых загружено</span></div>${warn}`;
}
function renderTable() {
  filtered.sort((a, b) => {
    let av = a[sortKey],
      bv = b[sortKey];
    if (sortKey === "score") {
      av = a._score;
      bv = b._score;
    }
    if (typeof av === "string") return av.localeCompare(bv, "ru") * sortDir;
    return ((av || 0) - (bv || 0)) * sortDir;
  });
  const tb = $("tbl").querySelector("tbody");
  tb.innerHTML = "";
  for (const p of filtered.slice(0, 500)) {
    const tr = document.createElement("tr");
    tr.className =
      (selected && selected.model === p.model ? "selected " : "") +
      (p.highlight ? "highlight" : "");
    tr.innerHTML =
      "<td><b>" +
      p.model +
      '</b><div class="tiny">' +
      (p.series || seriesOf(p.model) || "—") +
      "</div></td><td>" +
      fmt(p.flow_m3h) +
      "</td><td>" +
      fmt(p.head_m) +
      "</td><td>" +
      fmt(p.power_kw) +
      "</td><td>" +
      fmt(p.suction_diam_mm, 0) +
      "</td><td>" +
      fmt(p.discharge_diam_mm, 0) +
      "</td>";
    tr.onclick = () => selectPump(p);
    tb.appendChild(tr);
  }
  $("resultCount").textContent = filtered.length + " шт.";
}
function selectPump(p) {
  selected = p;
  renderTable();
  draw();
  renderDetail();
}
function renderDetail() {
  const el = $("detail");
  if (!selected) {
    el.innerHTML =
      '<h3>Насос не выбран</h3><p class="muted">Введите Q/H или выберите модель.</p>';
    return;
  }
  const SERIES_DESC = {
    WQ:   "Погружной канализационный электрический насос WQ(D)/WQ состоит из насоса, торцевых уплотнений и двигателя. В верхней части расположен асинхронный однофазный электродвигатель в герметичном корпусе. В нижней части расположен сам насос с незасоряющимся рабочим колесом. Двойное торцевое уплотнение расположено между насосом и электродвигателем, в качестве неподвижной части используется О-образное кольцо из маслостойкой резины. Все элементы соединяются винтами из нержавеющей стали. Насосы WQ(D)/WQ созданы для стационарной установки на автоматической трубной муфте в погружённом состоянии. В случае необходимости могут быть использованы как аварийные насосы. Насосы WQ(D)/WQ могут использоваться со взмучивающим устройством JY (опция). Насосы WQ(D)/WQ могут использоваться в непогружённом состоянии благодаря наличию встроенной рубашки охлаждения С (опция).",
    WQD:  "Погружной канализационный электрический насос WQ(D)/WQ состоит из насоса, торцевых уплотнений и двигателя. В верхней части расположен асинхронный однофазный электродвигатель в герметичном корпусе. В нижней части расположен сам насос с незасоряющимся рабочим колесом. Двойное торцевое уплотнение расположено между насосом и электродвигателем, в качестве неподвижной части используется О-образное кольцо из маслостойкой резины. Все элементы соединяются винтами из нержавеющей стали. Насосы WQ(D)/WQ созданы для стационарной установки на автоматической трубной муфте в погружённом состоянии. В случае необходимости могут быть использованы как аварийные насосы. Насосы WQ(D)/WQ могут использоваться со взмучивающим устройством JY (опция). Насосы WQ(D)/WQ могут использоваться в непогружённом состоянии благодаря наличию встроенной рубашки охлаждения С (опция). Двухполюсное исполнение (2P).",
    WQK:  "Погружной канализационный насос с режущим механизмом. Измельчает волокнистые включения перед перекачкой. IP68.",
    DGWQ: "Погружной дренажный насос. Перекачивает чистую воду и воду с небольшим содержанием примесей. Применяется в дренажных системах, подвалах, колодцах.",
    DGWQD:"Погружной дренажный насос (двухполюсное исполнение). Компактный, для дренажных систем и затопленных помещений.",
    IRG:  "Одноступенчатый вертикальный инлайн-насос. Фланцевое подключение в разрыв трубопровода. Для систем водоснабжения, отопления и промышленного водооборота. Стандарт GB/T 5657.",
    ISW:  "Горизонтальный одноступенчатый инлайн-насос. Аналог IRG, горизонтальное расположение. Для систем отопления, водоснабжения и кондиционирования.",
    ISG:  "Вертикальный одноступенчатый инлайн-насос повышенной производительности. Для систем водоснабжения и промышленного применения.",
    TD:   "Вертикальный одноступенчатый инлайн-насос компактной конструкции. Прямое фланцевое соединение с трубопроводом. Для систем HVAC, водоснабжения и промышленного применения.",
    CDL:  "Многоступенчатый вертикальный центробежный насос (нержавеющий рабочий орган). Для систем водоснабжения, пожаротушения, повышения давления.",
    CDLF: "Многоступенчатый вертикальный центробежный насос (полностью из нержавеющей стали). Для пищевой промышленности, систем водоснабжения и повышения давления.",
    YST:  "Погружной трубчатый насос для скважин. Узкий корпус для вертикальных скважин. Для водоснабжения из глубоких скважин.",
    ZW:   "Самовсасывающий канализационный насос. Не требует заливки перед пуском. Перекачивает сточные воды с твёрдыми включениями без подтопления насоса.",
    MHI:  "Многоступенчатый горизонтальный насос с нержавеющим рабочим органом. Для бытового водоснабжения, орошения и систем повышения давления.",
    CMI:  "Поверхностный центробежный насос. Для промышленных и бытовых систем водоснабжения.",
  };
  const SUBMERSIBLE = new Set(["WQ","WQD","WQK","DGWQ","DGWQD"]);

  const p = selected,
    r = p.raw,
    q = normNum($("q").value),
    h = normNum($("h").value),
    sh = normNum($("staticHead").value),
    n = Math.max(1, Math.round(normNum($("numPumps").value) || 1)),
    op = q && h ? findOP(p, q / n, h, sh) : interp(p, p.flow_m3h),
    photo = imageFor("photos", p),
    drawing = imageFor("drawings", p),
    graph = IMAGES.graphs[p.model + ".png"] || "";

  const seriesKey = (p.series || seriesOf(p.model) || "").toUpperCase();
  const seriesDesc = SERIES_DESC[seriesKey] || "";

  // Чертёж муфты для погружных насосов (WQ, WQK, DGWQ...)
  let couplingImg = "";
  if (SUBMERSIBLE.has(seriesKey)) {
    const dnMatch = p.model.match(/^(\d+)/);
    if (dnMatch) {
      const dnKey = "DN" + dnMatch[1] + ".png";
      couplingImg = (IMAGES.couplings && IMAGES.couplings[dnKey]) || "";
    }
  }

  el.innerHTML =
    "<h3>" +
    p.model +
    '</h3><p class="muted">Серия: ' +
    seriesKey +
    " · Рабочих насосов: " +
    n +
    "</p>" +
    (seriesDesc ? '<p class="series-desc">' + seriesDesc + "</p>" : "") +
    '<div class="kv"><div><b>Q ном.</b>' +
    fmt(p.flow_m3h) +
    " м³/ч</div><div><b>H ном.</b>" +
    fmt(p.head_m) +
    " м</div><div><b>P</b>" +
    fmt(p.power_kw) +
    " кВт</div><div><b>Ток</b>" +
    fmt(p.current_a) +
    " А</div><div><b>Dвс / Dн</b>" +
    fmt(p.suction_diam_mm, 0) +
    " / " +
    fmt(p.discharge_diam_mm, 0) +
    "</div><div><b>КПД</b>" +
    (p.efficiency ? fmt(p.efficiency * 100, 1) + " %" : "—") +
    "</div><div><b>Рабочая точка</b>Q=" +
    fmt(op.q * n, 1) +
    " H=" +
    fmt(op.h, 1) +
    "</div><div><b>Стат. напор</b>" +
    fmt(sh, 1) +
    ' м</div></div><h4>Материалы и мотор</h4><div class="kv"><div><b>Колесо</b>' +
    (r.mat_impeller || "—") +
    "</div><div><b>Корпус</b>" +
    (r.mat_inlet_outlet || "—") +
    "</div><div><b>Вал</b>" +
    (r.mat_shaft || "—") +
    "</div><div><b>IP / изоляция</b>" +
    (r.motor_ip_class || "—") +
    " / " +
    (r.motor_insulation || "—") +
    "</div><div><b>Обороты</b>" +
    (r.motor_rpm || "—") +
    "</div><div><b>Напряжение</b>" +
    (r.motor_voltage_v || "—") +
    "</div><div><b>Вес</b>" +
    (r.add_weight_kg || "—") +
    " кг</div><div><b>Установка</b>" +
    (r.inst_method || "—") +
    '</div></div><div class="imggrid">' +
    (photo ? '<img src="' + photo + '" alt="Фото">' : "") +
    (drawing ? '<img src="' + drawing + '" alt="Чертёж">' : "") +
    (graph ? '<img src="' + graph + '" alt="График">' : "") +
    "</div>" +
    (couplingImg
      ? '<h4>Чертёж муфты (DN' + p.model.match(/^(\d+)/)[1] + ')</h4>' +
        '<div class="imggrid"><img src="' + couplingImg + '" alt="Муфта"></div>'
      : "");
}

function draw() {
  const c = $("chart"),
    ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  const p = selected,
    L = 82,
    T = 34,
    R = 80,
    B = 68,
    W = c.width - L - R,
    H = c.height - T - B;
  function line(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  function dot(x, y, fill, stroke, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  function niceAxis(dataMax) {
    if (!Number.isFinite(dataMax) || dataMax <= 0) return { max: 10, step: 1 };
    const rough = dataMax / 8;
    const exp = Math.pow(10, Math.floor(Math.log10(rough)));
    const f = rough / exp;
    const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
    const max = Math.ceil(dataMax / step) * step;
    return { max, step };
  }
  ctx.strokeStyle = "#344054";
  ctx.lineWidth = 1.6;
  line(L, T, L, T + H);
  line(L, T + H, L + W, T + H);
  ctx.fillStyle = "#475467";
  ctx.font = "14px Arial";
  ctx.fillText("H, м", 18, 25);
  ctx.fillText("Q, м³/ч", L + W - 72, T + H + 48);
  if (!p || !p.curve || !p.curve.length) {
    ctx.fillStyle = "#667085";
    ctx.font = "22px Arial";
    ctx.fillText("Нет данных кривой для выбранного насоса", L + 70, T + H / 2);
    return;
  }
  const qIn = normNum($("q").value),
    hIn = normNum($("h").value),
    sh = normNum($("staticHead").value),
    n = Math.max(1, Math.round(normNum($("numPumps").value) || 1));
  const curve = p.curve.filter(
    (pt) => Number.isFinite(pt.q) && Number.isFinite(pt.h),
  );
  const qMaxRaw = Math.max(
    ...curve.map((x) => x.q * n),
    (p.flow_m3h || 0) * n,
    1,
  );
  const hMaxRaw = Math.max(...curve.map((x) => x.h), p.head_m || 0, 1);
  // ВАЖНО: оси теперь в реальных единицах и начинаются от нуля. Раньше кривая растягивалась в один и тот же визуальный диапазон,
  // поэтому разные насосы выглядели одинаково. Для насосной Q-H кривой нормальная практика — строить Total Head против Flow
  // в абсолютных координатах по паспортным точкам/полиному.
  const { max: maxQ, step: qStep } = niceAxis(qMaxRaw);
  const { max: maxH, step: hStep } = niceAxis(hMaxRaw * 1.05);
  const X = (q) => L + (q / maxQ) * W,
    Y = (v) => T + H - (v / maxH) * H;
  ctx.strokeStyle = "#d0d5dd";
  ctx.lineWidth = 1;
  for (let q = 0; q <= maxQ + 1e-9; q += qStep) {
    line(X(q), T, X(q), T + H);
  }
  for (let h = 0; h <= maxH + 1e-9; h += hStep) {
    line(L, Y(h), L + W, Y(h));
  }
  ctx.fillStyle = "#667085";
  ctx.font = "11px Arial";
  for (let q = 0; q <= maxQ + 1e-9; q += qStep) {
    ctx.fillText(q.toFixed(maxQ < 20 ? 1 : 0), X(q) - 14, T + H + 20);
  }
  for (let h = 0; h <= maxH + 1e-9; h += hStep) {
    ctx.fillText(h.toFixed(maxH < 20 ? 1 : 0), 28, Y(h) + 4);
  }
  // подсветка допустимой паспортной зоны выбранного насоса
  const qMin = Math.min(...curve.map((x) => x.q * n)),
    qMaxCurve = Math.max(...curve.map((x) => x.q * n));
  ctx.fillStyle = "rgba(23,105,224,.045)";
  ctx.fillRect(L, T, W, H);
  // H-Q выбранного насоса
  ctx.beginPath();
  curve.forEach((pt, i) => {
    const x = X(pt.q * n),
      y = Y(pt.h);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.strokeStyle = "#1769e0";
  ctx.lineWidth = 3.4;
  ctx.stroke();
  // паспортные опорные точки, чтобы было видно, что форма не одна статичная картинка
  const step = Math.max(1, Math.floor(curve.length / 8));
  for (let i = 0; i < curve.length; i += step) {
    dot(X(curve[i].q * n), Y(curve[i].h), "#fff", "#1769e0", 3.5);
  }
  // P-Q кривая мощности (правая ось, кВт)
  const hasPower = curve.some((x) => (x.p || 0) > 0.01);
  if (hasPower) {
    const pVals = curve.map((x) => x.p || 0);
    const { max: maxP } = niceAxis(Math.max(...pVals) * 1.1);
    const Yp = (v) => T + H - Math.max(0, v / maxP) * H;
    ctx.beginPath();
    curve.forEach((pt, i) => {
      const x = X(pt.q * n), y = Yp(pt.p || 0);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.strokeStyle = "#dc6803";
    ctx.lineWidth = 2.2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#dc6803";
    ctx.font = "12px Arial";
    ctx.fillText("P-Q кВт", L + 270, T + 17);
    ctx.font = "10px Arial";
    const pSteps = niceAxis(maxP).step;
    for (let pv = 0; pv <= maxP + 1e-9; pv += pSteps) {
      const y = Yp(pv);
      if (y >= T - 1 && y <= T + H + 1)
        ctx.fillText(pv.toFixed(pv < 10 ? 1 : 0), L + W + 4, y + 4);
    }
    ctx.fillStyle = "#dc6803";
    ctx.font = "11px Arial";
    ctx.fillText("P, кВт", L + W + 2, T - 6);
  }
  // η-Q кривая КПД
  const hasEta = curve.some((x) => (x.eta || 0) > 0.01);
  if (hasEta) {
    const Yeta = (v) => T + H - Math.max(0, Math.min(1, v)) * H;
    ctx.beginPath();
    curve.forEach((pt, i) => {
      const x = X(pt.q * n),
        y = Yeta(pt.eta || 0);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.strokeStyle = "#059669";
    ctx.lineWidth = 2.2;
    ctx.setLineDash([6, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#059669";
    ctx.font = "12px Arial";
    ctx.fillText("η-Q КПД", L + 155, T + 17);
    ctx.fillStyle = "#059669";
    ctx.font = "10px Arial";
    const etaX = hasPower ? L + W + 34 : L + W + 4;
    [0, 25, 50, 75, 100].forEach((pct) => {
      const y = Yeta(pct / 100);
      if (y >= T - 1 && y <= T + H + 1)
        ctx.fillText(pct + "%", etaX, y + 4);
    });
    ctx.fillStyle = "#059669";
    ctx.font = "11px Arial";
    ctx.fillText("η, %", etaX, T - 6);
  }
  ctx.fillStyle = "#1769e0";
  ctx.font = "bold 13px Arial";
  ctx.fillText("H-Q", L + 8, T + 17);
  if (qIn > 0 && hIn > 0 && hIn > sh) {
    const k = (hIn - sh) / (qIn * qIn);
    ctx.beginPath();
    let first = true;
    for (let i = 0; i <= 240; i++) {
      const q = (maxQ * i) / 240,
        h = sh + k * q * q;
      if (h > maxH * 1.04) break;
      const x = X(q),
        y = Y(h);
      if (first) {
        ctx.moveTo(x, y);
        first = false;
      } else ctx.lineTo(x, y);
    }
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = "#d92d20";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    dot(X(qIn), Y(hIn), "#fff", "#d92d20", 5);
    const op = findOP(p, qIn / n, hIn, sh),
      gq = op.q * n;
    dot(X(gq), Y(op.h), "#f04438", "#b42318", 7);
    ctx.strokeStyle = "#d92d20";
    ctx.setLineDash([4, 4]);
    line(X(gq), Y(op.h), X(gq), T + H);
    ctx.setLineDash([]);
    ctx.fillStyle = "#101828";
    ctx.font = "bold 13px Arial";
    ctx.fillText(
      "ОП: Q=" + gq.toFixed(1) + " H=" + op.h.toFixed(1),
      Math.min(X(gq) + 9, L + W - 150),
      Math.max(T + 18, Y(op.h) - 8),
    );
  }
  // паспортный номинал
  if (p.flow_m3h > 0 && p.head_m > 0) {
    dot(X(p.flow_m3h * n), Y(p.head_m), "#ecfdf3", "#079455", 6);
    ctx.fillStyle = "#067647";
    ctx.font = "12px Arial";
    ctx.fillText(
      "номинал",
      Math.min(X(p.flow_m3h * n) + 8, L + W - 65),
      Y(p.head_m) + 4,
    );
  }
  const c0 = coeff(p.raw, "curve_h");
  ctx.fillStyle = "#101828";
  ctx.font = "bold 15px Arial";
  ctx.fillText(p.model, L + W - 250, T + 20);
  ctx.fillStyle = "#667085";
  ctx.font = "11px Arial";
  ctx.fillText(
    "Оси: 0…" +
      maxQ.toFixed(0) +
      " м³/ч, 0…" +
      maxH.toFixed(0) +
      " м. Источник: " +
      (p.curve_source || "CSV") +
      "; H(Q)= " +
      c0
        .map((v, i) => (v ? "h" + i + "=" + v.toPrecision(4) : ""))
        .filter(Boolean)
        .join(", "),
    L,
    T + H + 43,
  );
}
init();
