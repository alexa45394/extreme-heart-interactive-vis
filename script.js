// ── CONFIG ──────────────────────────────────────────────────────────────────
const CITIES = ["San Diego","Los Angeles","New York","Miami","Phoenix"];
const SSPS   = ["ssp126","ssp245","ssp370","ssp585"];
const SSP_LABELS = {
  ssp126: "SSP1-2.6 — Strong mitigation",
  ssp245: "SSP2-4.5 — Intermediate",
  ssp370: "SSP3-7.0 — High emissions",
  ssp585: "SSP5-8.5 — Fossil fuel peak"
};
const SSP_COLORS = {
  ssp126: "#16a34a",
  ssp245: "#d97706",
  ssp370: "#ea580c",
  ssp585: "#dc2626"
};

// ── TOOLTIP ──────────────────────────────────────────────────────────────────
const tip = document.getElementById("tooltip");
function showTip(html, e) {
  tip.innerHTML = html;
  tip.classList.add("show");
  tip.style.left = (e.clientX + 15) + "px";
  tip.style.top  = (e.clientY - 36) + "px";
}
function hideTip() { tip.classList.remove("show"); }

// ── BUILD LEGEND ─────────────────────────────────────────────────────────────
function buildLegend(containerId) {
  const el = document.getElementById(containerId);
  SSPS.forEach(s => {
    const div = document.createElement("div");
    div.className = "leg-item";
    div.innerHTML = `<span class="leg-dot" style="background:${SSP_COLORS[s]}"></span>${SSP_LABELS[s]}`;
    el.appendChild(div);
  });
}
buildLegend("tempLegend");
buildLegend("precipLegend");

// ── POPULATE DROPDOWNS ────────────────────────────────────────────────────────
["tempCity","precipCity"].forEach(id => {
  CITIES.forEach(c => d3.select(`#${id}`).append("option").text(c).attr("value", c));
  d3.select(`#${id}`).property("value", "Los Angeles");
});
["tempScenario","precipScenario","mapScenario"].forEach(id => {
  SSPS.forEach(s => {
    d3.select(`#${id}`).append("option").text(SSP_LABELS[s]).attr("value", s);
  });
  d3.select(`#${id}`).property("value", "ssp245");
});

// ── POPULATE HEATMAP DROPDOWNS ───────────────────────────────────────────────
["tempHeatScenario", "precipHeatScenario"].forEach(id => {
  SSPS.forEach(s => {
    d3.select(`#${id}`).append("option").text(SSP_LABELS[s]).attr("value", s);
  });
  d3.select(`#${id}`).property("value", "ssp245");
});

// ── VIZ 1 & 2: LINE CHARTS ───────────────────────────────────────────────────
// Try yearly file first, fall back to monthly CSV
let csvData = [];

// We'll try the yearly file. If not found, fall back to monthly and aggregate.
d3.csv("data/city_climate_yearly.csv")
  .then(raw => {
    raw.forEach(d => {
      d.date          = new Date(+d.year, 0, 1);  // Jan 1 of that year
      d.temperature_f = +d.temperature_f;
      d.precip_mm     = +d.precip_mm;
    });
    csvData = raw;
    drawTemp();
    drawPrecip();
  })
  .catch(() => {
    // Fallback: load monthly CSV and aggregate to yearly
    d3.csv("data/city_climate.csv")
      .then(raw => {
        raw.forEach(d => {
          d.date          = new Date(d.date + "-01");
          d.temperature_f = +d.temperature_f;
          d.precip_mm     = +d.precip_mm;
          d.year          = d.date.getFullYear();
        });

        // Aggregate to yearly means, filter to 1950+
        const nested = d3.groups(
          raw.filter(d => d.year >= 1950),
          d => d.city, d => d.scenario, d => d.year
        );

        const yearly = [];
        for (const [city, byScenario] of nested) {
          for (const [scenario, byYear] of byScenario) {
            for (const [year, rows] of byYear) {
              yearly.push({
                date:          new Date(year, 0, 1),
                city,
                scenario,
                temperature_f: d3.mean(rows, r => r.temperature_f),
                precip_mm:     d3.mean(rows, r => r.precip_mm)
              });
            }
          }
        }
        csvData = yearly;
        drawTemp();
        drawPrecip();
      })
      .catch(() => {
        ["tempChart","precipChart"].forEach(id => {
          d3.select(`#${id}`).append("text")
            .attr("x",20).attr("y",40)
            .attr("fill","#dc2626")
            .text("⚠ Could not load city_climate_yearly.csv or city_climate.csv");
        });
      });
  });

function drawChart(svgId, variable, citySelectId, scenarioSelectId, yLabel) {
  const city     = d3.select(`#${citySelectId}`).property("value");
  const scenario = d3.select(`#${scenarioSelectId}`).property("value");
  const color    = SSP_COLORS[scenario];

  const filtered = csvData.filter(d =>
    d.city === city && d.scenario === scenario
  ).sort((a,b) => a.date - b.date);

  const svg = d3.select(`#${svgId}`);
  svg.selectAll("*").remove();
  if (!filtered.length) return;

  const W = svg.node().clientWidth  || 900;
  const H = svg.node().clientHeight || 360;
  const m = { top: 24, right: 24, bottom: 44, left: 58 };
  const w = W - m.left - m.right;
  const h = H - m.top  - m.bottom;
  const g = svg.append("g").attr("transform",`translate(${m.left},${m.top})`);

  // Scales
  const x = d3.scaleTime()
    .domain(d3.extent(filtered, d => d.date))
    .range([0, w]);

  const [yMin, yMax] = d3.extent(filtered, d => d[variable]);
  const yPad = (yMax - yMin) * 0.08;
  const y = d3.scaleLinear()
    .domain([yMin - yPad, yMax + yPad])
    .range([h, 0]);

  // Gridlines
  g.append("g").attr("class","grid")
    .call(d3.axisLeft(y).tickSize(-w).tickFormat(""));
  g.append("g").attr("class","grid")
    .attr("transform",`translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(10).tickSize(-h).tickFormat(""));

  // Axes
  g.append("g").attr("class","axis")
    .attr("transform",`translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(10).tickFormat(d3.timeFormat("%Y")));
  g.append("g").attr("class","axis")
    .call(d3.axisLeft(y).ticks(6));

  // Y-label
  g.append("text").attr("class","axis-label")
    .attr("transform","rotate(-90)")
    .attr("x",-h/2).attr("y",-46)
    .attr("text-anchor","middle")
    .text(yLabel);

  // 2015 line
  const x2015 = x(new Date("2015-01-01"));
  if (x2015 > 0 && x2015 < w) {
    g.append("line").attr("class","divider-line")
      .attr("x1",x2015).attr("x2",x2015).attr("y1",0).attr("y2",h);
    g.append("text").attr("class","axis-label")
      .attr("x",x2015+5).attr("y",14)
      .style("font-size","10px")
      .text("projection →");
  }

  // Area
  g.append("path").datum(filtered)
    .attr("fill", color).attr("opacity",.10)
    .attr("d", d3.area()
      .x(d => x(d.date))
      .y0(h).y1(d => y(d[variable]))
      .curve(d3.curveMonotoneX));

  // Line
  g.append("path").datum(filtered)
    .attr("fill","none")
    .attr("stroke", color)
    .attr("stroke-width", 2.2)
    .attr("d", d3.line()
      .x(d => x(d.date))
      .y(d => y(d[variable]))
      .curve(d3.curveMonotoneX));

  // Hover
  const bisect = d3.bisector(d => d.date).left;
  const dot = g.append("circle").attr("r",4)
    .attr("fill",color).attr("stroke","white").attr("stroke-width",2)
    .style("opacity",0).style("pointer-events","none");

  g.append("rect")
    .attr("fill","none").attr("pointer-events","all")
    .attr("width",w).attr("height",h)
    .on("mousemove", function(event) {
      const mx = d3.pointer(event)[0];
      const date = x.invert(mx);
      const i = Math.min(bisect(filtered, date, 1), filtered.length - 1);
      const d = filtered[i];
      if (!d) return;
      const val = d[variable];
      dot.style("opacity",1).attr("cx",x(d.date)).attr("cy",y(val));
      showTip(
        `<strong>${city}</strong> · ${scenario.toUpperCase()}<br/>` +
        `Year: ${d.date.getFullYear()}<br/>` +
        `<strong>${val.toFixed(variable==="temperature_f" ? 1 : 3)} ${variable==="temperature_f"?"°F":"mm/day"}</strong>`,
        event
      );
    })
    .on("mouseleave",() => { dot.style("opacity",0); hideTip(); });
}

function drawTemp() {
  drawChart("tempChart","temperature_f","tempCity","tempScenario","Temperature (°F)");
}
function drawPrecip() {
  drawChart("precipChart","precip_mm","precipCity","precipScenario","Precipitation (mm/day)");
}

d3.select("#tempCity,#tempScenario").on("change", drawTemp);
d3.select("#precipCity,#precipScenario").on("change", drawPrecip);

// Re-attach individually (the above only catches the last element)
["tempCity","tempScenario"].forEach(id =>
  d3.select(`#${id}`).on("change", drawTemp)
);
["precipCity","precipScenario"].forEach(id =>
  d3.select(`#${id}`).on("change", drawPrecip)
);


// ── VIZ 3: CALIFORNIA MAP ─────────────────────────────────────────────────────

// Accurate California boundary (sourced from public domain US states data)
const CA_GEOJSON = {
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[
      [-124.211606,41.998075],[-124.019966,41.998075],[-123.551454,41.998075],
      [-123.102900,42.003076],[-122.500988,42.008077],[-121.446777,41.977072],
      [-120.001861,41.994969],[-119.999908,40.264519],[-120.001861,38.999542],
      [-118.712549,38.101102],[-117.498779,37.218796],[-116.540527,36.156758],
      [-115.854492,35.837535],[-114.634399,35.001857],[-114.627686,34.873413],
      [-114.432373,34.869537],[-114.328613,34.687195],[-114.135254,34.256919],
      [-114.258057,34.174290],[-114.413574,34.109577],[-114.519287,33.960953],
      [-114.521240,33.549992],[-114.708252,33.399918],[-114.678955,33.040328],
      [-114.499512,33.007217],[-114.477539,32.972679],[-114.724121,32.715378],
      [-117.128906,32.531003],[-117.286987,33.138],[-117.339600,33.422],
      [-117.470,33.296],[-117.666,33.463],[-117.928,33.621],
      [-118.116,33.741],[-118.404,33.742],[-118.519,34.027],
      [-118.802,34.001],[-119.218,34.146],[-119.602,34.418],
      [-120.025,34.628],[-120.437,34.933],[-120.622,35.100],
      [-120.897,35.428],[-121.091,35.649],[-121.335,35.783],
      [-121.886,36.338],[-122.169,36.724],[-122.409,37.361],
      [-122.512,37.783],[-122.515,37.929],[-122.950,37.994],
      [-123.126,37.928],[-123.427,37.853],[-123.737,38.954],
      [-123.693,38.547],[-123.827,38.953],[-124.110,38.999],
      [-124.361,39.768],[-124.080,39.999],[-124.146,40.005],
      [-124.397,40.313],[-124.558,40.748],[-124.427,41.025],
      [-124.113,41.105],[-124.158,41.782],[-124.211606,41.998075]
    ]]
  }
};

let mrsoData = null;

// Build colorbar
(function buildColorbar() {
  const svg = d3.select("#colorbar");
  const defs = svg.append("defs");
  const grad = defs.append("linearGradient").attr("id","cbgrad")
    .attr("x1","0%").attr("x2","100%");
  [
    {o:"0%",   c:"#dc2626"},
    {o:"40%",  c:"#fca5a5"},
    {o:"50%",  c:"#f5f5f4"},
    {o:"60%",  c:"#93c5fd"},
    {o:"100%", c:"#1d4ed8"}
  ].forEach(s => grad.append("stop").attr("offset",s.o).attr("stop-color",s.c));
  svg.append("rect")
    .attr("width",240).attr("height",16).attr("rx",4)
    .attr("fill","url(#cbgrad)");
})();

d3.json("data/california_mrso.json").then(data => {
  mrsoData = data;
  drawCAMap();
  d3.select("#mapScenario").on("change", drawCAMap);
}).catch(() => {
  d3.select("#caMap").append("text")
    .attr("x",20).attr("y",40).attr("fill","#dc2626")
    .text("⚠ Could not load data/california_mrso.json");
});

function drawCAMap() {
  if (!mrsoData) return;
  const scenario = d3.select("#mapScenario").property("value");
  const raw = mrsoData[scenario];
  if (!raw || !raw.length) return;

  // Convert lon 0-360 → -180/180
  const pts = raw.map(d => ({
    lat: d.lat,
    lon: d.lon > 180 ? d.lon - 360 : d.lon,
    anomaly: d.anomaly
  })).filter(d => !isNaN(d.anomaly));

  const svg = d3.select("#caMap");
  svg.selectAll("*").remove();

  const W = 560, H = 500;
  svg.attr("width", W).attr("height", H).style("width","100%");

  // ── Grid spacing ──
  const lats = [...new Set(pts.map(d => d.lat))].sort(d3.ascending);
  const lons = [...new Set(pts.map(d => d.lon))].sort(d3.ascending);
  const dlat = lats.length > 1 ? lats[1] - lats[0] : 1;
  const dlon = lons.length > 1 ? lons[1] - lons[0] : 1;

  // ── Mercator projection sized to SVG, fitted to California GeoJSON ──
  const projection = d3.geoMercator()
    .fitExtent([[24, 24], [W - 24, H - 28]], CA_GEOJSON);
  const path = d3.geoPath().projection(projection);

  // ── Color scale ──
  const vals = pts.map(d => d.anomaly);
  const absMax = Math.min(
    d3.quantile(vals.map(Math.abs).sort(d3.ascending), 0.95) || 50, 150
  );
  const colorScale = d3.scaleDiverging()
    .domain([-absMax, 0, absMax])
    .interpolator(d3.interpolateRdBu);

  // ── Ocean background ──
  svg.append("rect").attr("width", W).attr("height", H).attr("fill", "#dce8f0");

  // ── Clip to California outline ──
  const defs = svg.append("defs");
  defs.append("clipPath").attr("id","ca-clip")
    .append("path").datum(CA_GEOJSON).attr("d", path);

  // ── Draw cells using the SAME projection as the outline ──
  const cells = svg.append("g").attr("clip-path","url(#ca-clip)");

  pts.forEach(d => {
    // Project the center point
    const [cx, cy] = projection([d.lon, d.lat]);
    // Project a point one cell-width away to get pixel cell size
    const [ex] = projection([d.lon + dlon, d.lat]);
    const [, ey] = projection([d.lon, d.lat - dlat]);
    const pw = Math.abs(ex - cx);
    const ph = Math.abs(ey - cy);

    cells.append("rect")
      .attr("x", cx - pw / 2)
      .attr("y", cy - ph / 2)
      .attr("width",  pw + 1)   // +1 to close gaps between cells
      .attr("height", ph + 1)
      .attr("fill", colorScale(d.anomaly))
      .on("mousemove", function(event) {
        showTip(
          `Lat <strong>${d.lat.toFixed(1)}°N</strong> · Lon <strong>${d.lon.toFixed(1)}°</strong><br/>` +
          `Anomaly: <strong>${d.anomaly > 0 ? "+" : ""}${d.anomaly.toFixed(1)} kg/m²</strong><br/>` +
          `<span style="color:${d.anomaly < 0 ? "#dc2626" : "#1d4ed8"}">${d.anomaly < 0 ? "Drier than baseline" : "Wetter than baseline"}</span>`,
          event
        );
      })
      .on("mouseleave", hideTip);
  });

  // ── California outline on top ──
  svg.append("path")
    .datum(CA_GEOJSON)
    .attr("d", path)
    .attr("fill", "none")
    .attr("stroke", "#1e293b")
    .attr("stroke-width", 1.5)
    .attr("stroke-linejoin", "round");

  // ── Label ──
  svg.append("text")
    .attr("x", W / 2).attr("y", H - 6)
    .attr("text-anchor", "middle")
    .attr("fill", "#6b7589").attr("font-size", "11px")
    .attr("font-family", "Inter, sans-serif")
    .text(`${SSP_LABELS[scenario]} · 2071–2100 vs 1985–2014 · MPI-ESM1-2-LR`);
}


// ── RESIZE ───────────────────────────────────────────────────────────────────
window.addEventListener("resize", () => {
  if (csvData.length) { drawTemp(); drawPrecip(); }
  if (mrsoData) drawCAMap();
});