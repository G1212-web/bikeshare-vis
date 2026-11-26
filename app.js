"use strict";

const $ = id => document.getElementById(id);
const days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const groups = ["休息日", "工作日"];
const hours = d3.range(24);
const palette = ["#e5f4f0", "#b3ded2", "#73bfae", "#308b7b", "#07574c"];
const number = new Intl.NumberFormat("zh-CN");
const decimal = new Intl.NumberFormat("zh-CN", {maximumFractionDigits: 1});
const hourName = hour => String(hour).padStart(2, "0") + ":00";
const filters = {year: $("year"), month: $("month"), weather: $("weather"), metric: $("metric")};
const defaults = {year: "", month: "", weather: "", metric: "6"};
const mean = item => item?.count ? item.sum / item.count : undefined;
const makeBin = () => ({sum: 0, count: 0});
const add = (bin, value) => { bin.sum += value; bin.count += 1; };
const tooltipText = item => item?.count
  ? decimal.format(mean(item)) + " 次/小时（" + number.format(item.count) + " 条）"
  : "无观测";

let cells, profiles;
let pinned = null;
let preview = null;
let focusDay = 0, focusHour = 0;
let plotHour = 0;
let plotWidth = 0;
let chart = {};

for (const month of d3.range(1, 13)) filters.month.add(new Option(month + " 月", month));

function summarize(rows, metric) {
  const grid = days.map(() => hours.map(makeBin));
  const curves = groups.map(() => hours.map(makeBin));
  const overall = makeBin();
  for (const row of rows) {
    const [, , weekday, hour, working] = row;
    const value = row[metric];
    add(grid[(weekday + 6) % 7][hour], value);
    add(curves[working][hour], value);
    add(overall, value);
  }
  return {grid, curves, overall};
}

// Use the same legend for any subsets of a given rental metric.
const scales = Object.fromEntries([6, 7, 8].map(metric => {
  const peak = d3.max(summarize(RIDES, metric).grid.flat(), mean);
  const step = Math.ceil(peak / 50) * 10;
  const cuts = d3.range(1, 5).map(i => step * i);
  return [metric, {cuts, color: d3.scaleThreshold(cuts, palette)}];
}));

const heat = d3.select("#heatmap");
const tickRow = heat.append("div").attr("class", "heat-row").attr("aria-hidden", "true");
tickRow.append("span");
tickRow.selectAll(".hour-label").data(hours).join("span")
  .attr("class", "axis hour-label").text(hour => hour % 3 === 0 || hour === 23 ? String(hour).padStart(2, "0") : "");
const heatRows = heat.selectAll(".heat-data").data(days).join("div")
  .attr("class", "heat-row heat-data").attr("role", "row");
heatRows.append("span").attr("class", "axis").attr("role", "rowheader").text(day => day);
const tiles = heatRows.selectAll(".tile").data((_, day) => hours.map(hour => ({day, hour})))
  .join("button").attr("type", "button").attr("class", "tile").attr("role", "gridcell")
  .attr("aria-colindex", item => item.hour + 1)
  .attr("tabindex", item => item.day === 0 && item.hour === 0 ? 0 : -1)
  .on("pointerenter focus", (_, item) => setPreview(item))
  .on("pointerleave blur", () => setPreview(null))
  .on("click", (_, item) => { setGridFocus(item); togglePin(item); })
  .on("keydown", (event, item) => {
    const offsets = {ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0]};
    if (event.key === "Escape") { clearPin(); return; }
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    const [dy, dx] = offset;
    const next = {day: Math.max(0, Math.min(6, item.day + dy)), hour: Math.max(0, Math.min(23, item.hour + dx))};
    setGridFocus(next);
    tiles.filter(d => d.day === next.day && d.hour === next.hour).node().focus();
  });

function setGridFocus({day, hour}) {
  focusDay = day;
  focusHour = hour;
  tiles.attr("tabindex", d => d.day === focusDay && d.hour === focusHour ? 0 : -1);
}

function setPreview(item) {
  preview = item;
  drawSelection();
}

function togglePin(item) {
  pinned = pinned?.day === item.day && pinned?.hour === item.hour ? null : item;
  drawSelection();
}

function clearPin() {
  pinned = null;
  preview = null;
  drawSelection();
}

function drawSelection() {
  const current = preview ?? pinned;
  tiles.classed("is-hour", item => current?.hour === item.hour)
    .classed("is-cell", item => current?.hour === item.hour && current?.day === item.day)
    .attr("aria-selected", item => String(pinned?.hour === item.hour && (pinned.day === undefined || pinned.day === item.day)));
  $("unpin").hidden = !pinned;
  $("cell-title").textContent = current?.day === undefined ? "格子详情" : days[current.day] + " " + hourName(current.hour);
  $("cell-detail").textContent = current?.day === undefined
    ? "将指针移到格子上，或用方向键浏览。"
    : tooltipText(cells[current.day][current.hour]);
  $("line-detail").textContent = current
    ? hourName(current.hour) + " · 工作日 " + tooltipText(profiles[1][current.hour]) +
      " · 休息日 " + tooltipText(profiles[0][current.hour])
    : "选择一个小时，读取两组平均值与观测数。";
  if (!chart.marker) return;
  chart.marker.attr("display", current ? null : "none");
  chart.hits.attr("aria-pressed", hour => String(pinned?.hour === hour));
  if (!current) return;
  const x = chart.x(current.hour);
  chart.marker.select("line").attr("x1", x).attr("x2", x);
  chart.marker.selectAll("circle").each(function(group) {
    const value = mean(profiles[group][current.hour]);
    d3.select(this).attr("display", value === undefined ? "none" : null)
      .attr("cx", x).attr("cy", value === undefined ? null : chart.y(value));
  });
}

function drawHeat(metric) {
  const {cuts, color} = scales[metric];
  tiles.classed("missing", ({day, hour}) => !cells[day][hour].count)
    .style("background-color", ({day, hour}) => {
      const value = mean(cells[day][hour]);
      return value === undefined ? null : color(value);
    })
    .attr("aria-label", ({day, hour}) => days[day] + " " + hourName(hour) + " " + tooltipText(cells[day][hour]));
  const intervals = palette.map((swatch, index) => {
    const lower = cuts[index - 1] ?? 0;
    return {swatch, label: index < cuts.length ? lower + "–<" + cuts[index] : "≥" + lower};
  });
  const items = d3.select("#legend").selectAll(".legend-item").data(intervals).join(enter => {
    const item = enter.append("span").attr("class", "legend-item");
    item.append("i").attr("class", "swatch").attr("aria-hidden", "true");
    item.append("span");
    return item;
  });
  items.select("i").style("background-color", item => item.swatch);
  items.select("span").text(item => item.label);
}

function drawPlot() {
  const width = Math.max(245, Math.floor($("plot").clientWidth));
  plotWidth = width;
  const height = width < 560 ? 219 : 252;
  const margin = {left: 40, right: 13, top: 12, bottom: 29};
  const bottom = height - margin.bottom;
  const right = width - margin.right;
  const colors = ["#a04b25", "#006858"];
  const x = d3.scaleLinear([0, 23], [margin.left, right]);
  const y = d3.scaleLinear([0, d3.max(profiles.flat(), mean) || 1], [bottom, margin.top]).nice(4);
  const plot = d3.select("#plot");
  plot.selectAll("*").remove();
  const svg = plot.append("svg").attr("viewBox", [0, 0, width, height])
    .attr("role", "group").attr("aria-label", "工作日与休息日逐小时折线图，方向键切换小时");
  const axisY = svg.append("g").attr("transform", "translate(" + margin.left + ",0)")
    .call(d3.axisLeft(y).ticks(4).tickSize(-(right - margin.left)).tickPadding(6));
  axisY.select(".domain").remove();
  axisY.selectAll(".tick line").attr("stroke", "#dbe8e5");
  const ticks = width < 460 ? [0, 6, 12, 18, 23] : [0, 3, 6, 9, 12, 15, 18, 21, 23];
  const axisX = svg.append("g").attr("transform", "translate(0," + bottom + ")")
    .call(d3.axisBottom(x).tickValues(ticks).tickFormat(h => String(h).padStart(2, "0")).tickSize(4));
  axisX.selectAll("line,path").attr("stroke", "#8aa6a3");
  const line = d3.line().defined(item => item.count > 0).x((_, i) => x(i)).y(item => y(mean(item)));
  profiles.forEach((profile, group) => {
    svg.append("path").datum(profile).attr("d", line).attr("fill", "none")
      .attr("stroke", colors[group]).attr("stroke-width", 2.6)
      .attr("stroke-dasharray", group === 0 ? "6 4" : null);
    svg.append("g").selectAll("circle").data(profile.map((item, hour) => ({item, hour})).filter(d => d.item.count))
      .join("circle").attr("cx", d => x(d.hour)).attr("cy", d => y(mean(d.item)))
      .attr("r", width < 460 ? 1.7 : 2.2).attr("fill", group === 0 ? "#fff" : colors[group])
      .attr("stroke", colors[group]).attr("stroke-width", 1.4);
  });
  const marker = svg.append("g").attr("pointer-events", "none");
  marker.append("line").attr("y1", margin.top).attr("y2", bottom)
    .attr("stroke", "#335555").attr("stroke-dasharray", "4 3");
  marker.selectAll("circle").data([0, 1]).join("circle")
    .attr("r", 5).attr("fill", group => colors[group]).attr("stroke", "#fff").attr("stroke-width", 1.6);
  const step = x(1) - x(0);
  const hits = svg.append("g").selectAll(".hour-hit").data(hours).join("rect")
    .attr("class", "hour-hit").attr("role", "button").attr("fill", "transparent")
    .attr("x", hour => hour === 0 ? x(0) : x(hour) - step / 2)
    .attr("width", hour => hour === 0 || hour === 23 ? step / 2 : step)
    .attr("y", margin.top).attr("height", bottom - margin.top)
    .attr("tabindex", hour => hour === plotHour ? 0 : -1)
    .attr("aria-label", hour => hourName(hour) + "，工作日 " + tooltipText(profiles[1][hour]) + "，休息日 " + tooltipText(profiles[0][hour]))
    .style("cursor", "pointer")
    .on("pointerenter focus", (_, hour) => setPreview({hour}))
    .on("pointerleave blur", () => setPreview(null))
    .on("click", (_, hour) => { setPlotFocus(hour); togglePin({hour}); })
    .on("keydown", (event, hour) => {
      if (event.key === "Escape") { clearPin(); return; }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        togglePin({hour});
        return;
      }
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const next = Math.max(0, Math.min(23, hour + (event.key === "ArrowLeft" ? -1 : 1)));
      setPlotFocus(next);
      hits.filter(value => value === next).node().focus();
    });
  function setPlotFocus(hour) {
    plotHour = hour;
    hits.attr("tabindex", value => value === plotHour ? 0 : -1);
  }
  chart = {x, y, marker, hits};
  drawSelection();
}

function updateTable() {
  const table = d3.select("#table").selectAll("table").data([null]).join("table");
  const header = table.selectAll("thead").data([null]).join("thead")
    .selectAll("tr").data([null]).join("tr");
  header.selectAll("th").data(["小时", "工作日", "休息日"]).join("th").attr("scope", "col").text(d => d);
  const rows = table.selectAll("tbody").data([null]).join("tbody")
    .selectAll("tr").data(hours).join("tr");
  rows.selectAll("th").data(h => [h]).join("th").attr("scope", "row").text(hourName);
  rows.selectAll("td").data(h => [profiles[1][h], profiles[0][h]]).join("td").text(tooltipText);
}

function update() {
  const {year, month, weather, metric} = Object.fromEntries(
    Object.entries(filters).map(([name, element]) => [name, element.value])
  );
  const rows = RIDES.filter(row => (year === "" || row[0] === +year)
    && (month === "" || row[1] === +month) && (weather === "" || row[5] === +weather));
  const {grid, curves, overall} = summarize(rows, +metric);
  cells = grid;
  profiles = curves;
  $("count").textContent = number.format(overall.count);
  $("mean").textContent = overall.count ? decimal.format(mean(overall)) : "—";
  $("summary").textContent = overall.count ? [1, 0].map(group => {
    const profile = profiles[group];
    const hour = d3.maxIndex(profile, mean);
    return hour < 0 ? groups[group] + "无观测。" :
      groups[group] + "峰值在 " + hourName(hour) + "，" + tooltipText(profile[hour]) + "。";
  }).join("") : "当前筛选组合没有观测记录。请调整筛选条件。";
  drawHeat(metric);
  drawPlot();
  updateTable();
}

function apply(values) {
  Object.entries(values).forEach(([name, value]) => { filters[name].value = value; });
  pinned = null;
  preview = null;
  update();
}

const queryTokens = [
  [/^(201[12])年?/, "year", match => String(+match[1] - 2011)],
  [/^(1[0-2]|[1-9])月/, "month", match => match[1]],
  [/^(晴或多云|晴天|多云)/, "weather", () => "1"],
  [/^(雾或阴天|雾天|阴天)/, "weather", () => "2"],
  [/^(小雨或小雪|小雨|小雪)/, "weather", () => "3"],
  [/^(强降水或雪雾|强降水|雪雾)/, "weather", () => "4"],
  [/^(全部骑行|注册用户|临时用户)/, "metric", match => String(["全部骑行", "注册用户", "临时用户"].indexOf(match[1]) + 6)]
];

function parseQuery(input) {
  let rest = input.normalize("NFKC").trim();
  const values = {};
  while (rest) {
    rest = rest.replace(/^[\s,，、]+/, "");
    if (!rest) break;
    const token = queryTokens.find(([pattern]) => pattern.test(rest));
    if (!token) throw new Error("无法识别「" + rest + "」。可参考输入框示例。");
    const [pattern, key, value] = token;
    const match = rest.match(pattern);
    if (key in values) throw new Error("每次查询只可以为同一筛选项指定一个值。");
    values[key] = value(match);
    rest = rest.slice(match[0].length);
  }
  if (!Object.keys(values).length) throw new Error("请输入要筛选的条件。");
  return values;
}

$("query-form").addEventListener("submit", event => {
  event.preventDefault();
  const status = $("query-result");
  try {
    const values = parseQuery($("query").value);
    apply({...defaults, ...values});
    status.classList.remove("error");
    status.textContent = "已应用 " + Object.keys(values).map(key => filters[key].selectedOptions[0].text).join(" · ");
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message;
  }
});

Object.values(filters).forEach(control => control.addEventListener("change", () => {
  $("query-result").textContent = "";
  pinned = null;
  preview = null;
  update();
}));
$("reset").addEventListener("click", () => {
  $("query").value = "";
  $("query-result").textContent = "";
  apply(defaults);
});
$("unpin").addEventListener("click", () => {
  const previous = pinned;
  clearPin();
  if (previous.day !== undefined) {
    setGridFocus(previous);
    tiles.filter(d => d.day === previous.day && d.hour === previous.hour).node().focus();
  } else {
    chart.hits.filter(hour => hour === previous.hour).node().focus();
  }
});
update();
new ResizeObserver(() => {
  if (Math.max(245, Math.floor($("plot").clientWidth)) !== plotWidth) drawPlot();
}).observe($("plot"));
