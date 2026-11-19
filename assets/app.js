const state = { data: null, scope: null, level: "campus", sortKey: "median_price", sortDir: -1, charts: {} };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function money(x) {
  if (x === null || x === undefined) return "n/a";
  return "$" + Math.round(x).toLocaleString("en-US");
}

function moneyShort(x) {
  if (x >= 1000000) return "$" + parseFloat((x / 1000000).toFixed(2)) + "M";
  if (x >= 1000) return "$" + Math.round(x / 1000) + "K";
  return "$" + x;
}

function num(x) {
  if (x === null || x === undefined) return "n/a";
  return Math.round(x).toLocaleString("en-US");
}

function pct(x, signed) {
  if (x === null || x === undefined) return "n/a";
  const text = (x * 100).toFixed(1) + "%";
  return signed && x > 0 ? "+" + text : text.replace("-", "−");
}

function longDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function theme() {
  return {
    series: css("--series-1"),
    surface: css("--surface"),
    text: css("--text-secondary"),
    axis: css("--axis-text"),
    grid: css("--grid"),
    baseline: css("--baseline"),
  };
}

function baseOptions(t, yFormat, yZero) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { displayColors: false, padding: 10 },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: t.baseline },
        ticks: { color: t.axis, maxRotation: 0, autoSkipPadding: 8 },
      },
      y: {
        beginAtZero: yZero,
        grid: { color: t.grid },
        border: { display: false },
        ticks: { color: t.axis, maxTicksLimit: 6, callback: yFormat },
      },
    },
  };
}

function barDataset(t, values) {
  return {
    data: values,
    backgroundColor: t.series,
    hoverBackgroundColor: t.series,
    borderRadius: 4,
    borderSkipped: "start",
    maxBarThickness: 24,
  };
}

function buildCharts() {
  Object.values(state.charts).forEach(c => c.destroy());
  const t = theme();
  Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  Chart.defaults.color = t.text;

  const distance = baseOptions(t, v => "$" + v, true);
  distance.plugins.tooltip.callbacks = {
    label: ctx => {
      const band = state.scope.distance_bands[ctx.dataIndex];
      return [
        "Median per sq ft: " + money(band.median_ppsf),
        "Median price: " + money(band.median_price),
        "Sales: " + num(band.sales),
      ];
    },
  };
  state.charts.distance = new Chart(document.getElementById("chart-distance"), {
    type: "bar",
    data: { labels: [], datasets: [barDataset(t, [])] },
    options: distance,
  });

  const quarters = baseOptions(t, v => moneyShort(v), false);
  quarters.plugins.tooltip.callbacks = {
    label: ctx => {
      const q = state.scope.quarters[ctx.dataIndex];
      return ["Median price: " + money(q.median_price), "Sales: " + num(q.sales)];
    },
  };
  state.charts.quarters = new Chart(document.getElementById("chart-quarters"), {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        data: [],
        borderColor: t.series,
        backgroundColor: t.series,
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBorderColor: t.surface,
        pointBorderWidth: 2,
        spanGaps: false,
        tension: 0,
      }],
    },
    options: quarters,
  });

  const hist = baseOptions(t, v => num(v), true);
  hist.scales.x.ticks.callback = function (value, index) {
    return index % 5 === 0 || index === this.chart.data.labels.length - 1 ? this.getLabelForValue(value) : "";
  };
  hist.scales.x.ticks.autoSkip = false;
  hist.datasets = { bar: { categoryPercentage: 1, barPercentage: 0.88 } };
  hist.plugins.tooltip.callbacks = {
    title: items => {
      const b = state.scope.price_histogram[items[0].dataIndex];
      return b.high === null ? moneyShort(b.low) + " or more" : moneyShort(b.low) + " to " + moneyShort(b.high);
    },
    label: ctx => "Sales: " + num(ctx.raw),
  };
  state.charts.histogram = new Chart(document.getElementById("chart-histogram"), {
    type: "bar",
    data: { labels: [], datasets: [barDataset(t, [])] },
    options: hist,
  });

  const months = baseOptions(t, v => num(v), true);
  months.plugins.tooltip.callbacks = {
    label: ctx => {
      const m = state.scope.months[ctx.dataIndex];
      return ["Average per month: " + m.avg_sales.toLocaleString("en-US"), "Total: " + num(m.sales) + " over " + m.years + " years"];
    },
  };
  state.charts.months = new Chart(document.getElementById("chart-months"), {
    type: "bar",
    data: { labels: [], datasets: [barDataset(t, [])] },
    options: months,
  });
}

function miniTable(headers, rows) {
  const head = "<tr>" + headers.map(h => "<th>" + h + "</th>").join("") + "</tr>";
  const body = rows.map(r => "<tr>" + r.map(c => "<td>" + c + "</td>").join("") + "</tr>").join("");
  return '<table class="mini-table"><thead>' + head + "</thead><tbody>" + body + "</tbody></table>";
}

function tile(label, value, sub) {
  return '<div class="tile"><p class="tile-label">' + label + '</p><p class="tile-value">' + value +
    '</p><p class="tile-sub">' + sub + "</p></div>";
}

function renderHeadline(s) {
  const r = state.data.rules;
  document.getElementById("hero-value").textContent = money(s.median_price);
  document.getElementById("hero-sub").textContent =
    "Middle half sold for " + money(s.p25_price) + " to " + money(s.p75_price);

  const domShare = s.sales ? s.dom_sales / s.sales : 0;
  const change = s.price_change_12m === null
    ? tile("12-month price change", "n/a", "Fewer than " + r.min_window_sales + " sales in one of the two periods")
    : tile("12-month price change", pct(s.price_change_12m, true),
      "Median, " + longDate(r.last_12[0]) + " to " + longDate(r.last_12[1]) + " vs. the 12 months before");

  document.getElementById("tiles").innerHTML = [
    tile("Sales", num(s.sales), s.excluded_by_price === 0 ? "None left out by the price rule" : num(s.excluded_by_price) + " left out by the price rule"),
    tile("Price per square foot", money(s.median_ppsf), "Median, homes of " + num(r.sqft_min) + "+ sq ft"),
    tile("Days on market", num(s.median_dom) + " days",
      "Median, listing to contract · " + pct(domShare) + " of sales have both dates"),
    change,
    tile("Typical home", num(s.median_sqft) + " sq ft",
      "Medians: " + num(s.median_beds) + " beds, built " + Math.round(s.median_year_built)),
    tile("Distance to campus", s.median_miles.toFixed(1) + " mi", "Median straight-line distance"),
  ].join("");

  let detail = "";
  if (s.kind === "all") {
    const c = state.data.counts;
    detail = c.cities + " cities and towns in " + c.states + " states";
  } else if (s.kind === "campus") {
    detail = "Includes " + s.places.join(" · ");
  } else {
    detail = "Nearest campus: " + s.campus;
  }
  document.getElementById("scope-detail").textContent = detail;
}

function renderCharts(s) {
  const r = state.data.rules;

  const bands = s.distance_bands;
  state.charts.distance.data.labels = bands.map(b => b.label);
  state.charts.distance.data.datasets[0].data = bands.map(b => b.median_ppsf);
  state.charts.distance.update();
  const hidden = bands.filter(b => b.median_ppsf === null && b.sales > 0).map(b => b.label + " (" + b.sales + " sales)");
  const empty = bands.filter(b => b.sales === 0).map(b => b.label);
  let note = "";
  if (s.kind === "all") note = "All campuses together mix 11 markets with different price levels, so pick a campus for a cleaner read. ";
  if (hidden.length) note += "Not shown, fewer than " + r.min_band_sales + " sales: " + hidden.join(", ") + ". ";
  if (empty.length) note += "No sales: " + empty.join(", ") + ".";
  document.getElementById("note-distance").textContent = note.trim();
  document.getElementById("table-distance").innerHTML = miniTable(
    ["Distance", "Median per sq ft", "Median price", "Sales"],
    bands.map(b => [b.label, money(b.median_ppsf), money(b.median_price), num(b.sales)]));

  const q = s.quarters;
  state.charts.quarters.data.labels = q.map(x => x.quarter);
  state.charts.quarters.data.datasets[0].data = q.map(x => x.median_price);
  state.charts.quarters.update();
  const thin = q.filter(x => x.median_price === null).map(x => x.quarter);
  document.getElementById("note-quarters").textContent =
    "Sales start " + longDate(r.first_sale) + ", so 2023 Q1 is left out. 2026 Q1 runs through " + longDate(r.last_sale) + "." +
    (thin.length ? " Not shown, fewer than " + r.min_quarter_sales + " sales: " + thin.join(", ") + "." : "");
  document.getElementById("table-quarters").innerHTML = miniTable(
    ["Quarter", "Median price", "Sales"], q.map(x => [x.quarter, money(x.median_price), num(x.sales)]));

  const h = s.price_histogram;
  state.charts.histogram.data.labels = h.map(b => b.high === null ? moneyShort(b.low) + "+" : moneyShort(b.low));
  state.charts.histogram.data.datasets[0].data = h.map(b => b.count);
  state.charts.histogram.update();
  document.getElementById("table-histogram").innerHTML = miniTable(
    ["Price range", "Sales"],
    h.map(b => [b.high === null ? money(b.low) + " or more" : money(b.low) + " to " + money(b.high - 1), num(b.count)]));

  const m = s.months;
  state.charts.months.data.labels = m.map(x => MONTHS[x.month - 1]);
  state.charts.months.data.datasets[0].data = m.map(x => x.avg_sales);
  state.charts.months.update();
  document.getElementById("note-months").textContent =
    "Complete months from " + longDate(r.month_window[0]) + " to " + longDate(r.month_window[1]) +
    ". March is averaged over 2 years, every other month over 3.";
  document.getElementById("table-months").innerHTML = miniTable(
    ["Month", "Average per month", "Total sales", "Years"],
    m.map(x => [MONTHS[x.month - 1], x.avg_sales.toLocaleString("en-US"), num(x.sales), x.years]));
}

const COLUMNS = [
  { key: "name", label: "Market", fmt: s => s.name },
  { key: "sales", label: "Sales", fmt: s => num(s.sales) },
  { key: "median_price", label: "Median price", fmt: s => money(s.median_price) },
  { key: "median_ppsf", label: "Per sq ft", fmt: s => money(s.median_ppsf) },
  { key: "median_dom", label: "Days on market", fmt: s => num(s.median_dom) },
  { key: "no_list_date_share", label: "No list date", fmt: s => pct(s.no_list_date_share) },
  { key: "price_change_12m", label: "12-month change", fmt: s => pct(s.price_change_12m, true) },
  { key: "median_sqft", label: "Median sq ft", fmt: s => num(s.median_sqft) },
];

function renderTable() {
  const rows = state.data.scopes.filter(s => s.kind === state.level);
  rows.sort((a, b) => {
    const x = a[state.sortKey];
    const y = b[state.sortKey];
    if (x === null) return 1;
    if (y === null) return -1;
    if (typeof x === "string") return x.localeCompare(y) * state.sortDir;
    return (x - y) * state.sortDir;
  });
  const head = "<thead><tr>" + COLUMNS.map(c => {
    const active = c.key === state.sortKey;
    const sort = active ? (state.sortDir === 1 ? "ascending" : "descending") : "none";
    const arrow = active ? (state.sortDir === 1 ? " ▲" : " ▼") : "";
    return '<th aria-sort="' + sort + '"><button type="button" data-key="' + c.key + '">' + c.label + arrow + "</button></th>";
  }).join("") + "</tr></thead>";
  const body = "<tbody>" + rows.map(s => {
    const cls = s.id === state.scope.id ? ' class="selected"' : "";
    return '<tr data-id="' + s.id + '"' + cls + ' tabindex="0">' + COLUMNS.map(c => {
      const value = c.fmt(s);
      return value === "n/a" ? '<td class="na">n/a</td>' : "<td>" + value + "</td>";
    }).join("") + "</tr>";
  }).join("") + "</tbody>";
  document.getElementById("compare-table").innerHTML = head + body;
}

function renderNotes() {
  const c = state.data.counts;
  const r = state.data.rules;
  const all = state.data.scopes[0];
  const notes = [
    "<strong>Which sales count.</strong> Only sales from " + money(r.price_min) + " to " + money(r.price_max) +
      ". That leaves out " + c.below_min + " sales under " + money(r.price_min) + " (one of them at $0) and " + c.above_max +
      " over " + money(r.price_max) + " (up to " + money(c.max_price) + "), " + num(c.rows - c.kept) + " of " + num(c.rows) +
      " sales in all. Every figure uses the remaining " + num(c.kept) + ".",
    "<strong>Medians, not averages.</strong> Home prices are skewed by a few expensive sales, so every price, size and time on this page is a median.",
    "<strong>Price per square foot</strong> is sale price divided by finished living area, for homes with at least " + num(r.sqft_min) +
      " sq ft recorded. " + c.sqft_below_min + " homes list less than that (most list 0) and " + num(c.sqft_missing) +
      " list none, so they are left out of this figure only.",
    "<strong>Days on market</strong> runs from the listing date to the contract date, not to the closing date, the way listing sites count it. It needs both dates, which " +
      num(all.dom_sales) + " kept sales have. A blank date is not zero: homes sold with no listing, often new construction, are left out, so this figure describes listed homes. The share with no list date differs by market and is in the table above.",
    "<strong>12-month price change</strong> compares the median price of sales closed " + longDate(r.last_12[0]) + " to " + longDate(r.last_12[1]) +
      " with the 12 months before, and is shown only when each period has at least " + r.min_window_sales +
      " sales. It reflects changes in which homes sold as well as in prices, so it is not a repeat-sales price index.",
    "<strong>Distance to campus</strong> is the straight-line distance from each home to its nearest campus landmark, assigned from the home's coordinates rather than its city name. Distance bands with fewer than " +
      r.min_band_sales + " sales are not shown.",
    "<strong>Every row is kept as its own sale.</strong> Some street addresses repeat, mostly separate condo units in State College, so no rows were removed as duplicates. The <code>home_type</code> column is not used because it labels nearly every home, condos included, as single family.",
    "<strong>Source.</strong> Values are as one source reported them in March 2026, not checked against county records. Sales closed " +
      longDate(r.first_sale) + " to " + longDate(r.last_sale) + ".",
  ];
  document.getElementById("notes-list").innerHTML = notes.map(n => "<li>" + n + "</li>").join("");
}

function select(id, push) {
  const scope = state.data.scopes.find(s => s.id === id) || state.data.scopes[0];
  state.scope = scope;
  document.getElementById("scope").value = scope.id;
  renderHeadline(scope);
  renderCharts(scope);
  renderTable();
  if (push) history.replaceState(null, "", scope.id === "all" ? location.pathname : "#" + encodeURIComponent(scope.id));
}

function fillSelect() {
  const groups = [["all", "Overview"], ["campus", "Campuses"], ["city", "Cities and towns"]];
  const el = document.getElementById("scope");
  el.innerHTML = groups.map(([kind, label]) => {
    const options = state.data.scopes.filter(s => s.kind === kind)
      .map(s => '<option value="' + s.id + '">' + s.name + "</option>").join("");
    return '<optgroup label="' + label + '">' + options + "</optgroup>";
  }).join("");
}

function wire() {
  document.getElementById("scope").addEventListener("change", e => select(e.target.value, true));

  document.querySelectorAll(".toggle button").forEach(btn => {
    btn.addEventListener("click", () => {
      state.level = btn.dataset.level;
      document.querySelectorAll(".toggle button").forEach(b => b.setAttribute("aria-pressed", b === btn ? "true" : "false"));
      renderTable();
    });
  });

  const table = document.getElementById("compare-table");
  table.addEventListener("click", e => {
    const header = e.target.closest("button[data-key]");
    if (header) {
      const key = header.dataset.key;
      state.sortDir = key === state.sortKey ? -state.sortDir : (key === "name" ? 1 : -1);
      state.sortKey = key;
      renderTable();
      return;
    }
    const row = e.target.closest("tr[data-id]");
    if (row) {
      select(row.dataset.id, true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
  table.addEventListener("keydown", e => {
    const row = e.target.closest("tr[data-id]");
    if (row && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      select(row.dataset.id, true);
    }
  });

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    buildCharts();
    renderCharts(state.scope);
  });
}

async function start() {
  const response = await fetch("data/site_summary.json");
  state.data = await response.json();
  const r = state.data.rules;
  document.getElementById("date-range").textContent = longDate(r.first_sale) + " to " + longDate(r.last_sale);
  document.getElementById("lede-sales").textContent = num(state.data.counts.kept);
  fillSelect();
  buildCharts();
  renderNotes();
  wire();
  select(decodeURIComponent(location.hash.slice(1)) || "all", false);
}

start().catch(err => {
  document.getElementById("hero-value").textContent = "Could not load data";
  console.error(err);
});
