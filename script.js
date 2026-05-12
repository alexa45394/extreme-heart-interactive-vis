// ── State ──
const S = {
  data:null, countries:[], byName:new Map(),
  selected:null, basin:'All', metric:'slr2100', zoom:null,
};

// ── ISO numeric id → JSON country name ──
// countries-110m uses numeric .id only — no .properties.name
const ISO = {
  50:"Bangladesh", 356:"India", 144:"Sri Lanka", 104:"Myanmar",
  764:"Thailand", 586:"Pakistan", 706:"Somalia", 834:"Tanzania",
  508:"Mozambique", 450:"Madagascar", 404:"Kenya", 512:"Oman",
  887:"Yemen", 364:"Iran", 462:"Maldives", 360:"Indonesia",
  608:"Philippines", 704:"Vietnam", 392:"Japan", 156:"China",
  410:"South Korea", 408:"North Korea", 158:"Taiwan", 152:"Chile",
  604:"Peru", 484:"Mexico", 840:"United States (California)", 218:"Ecuador",
  170:"Colombia", 598:"Papua New Guinea", 36:"Australia", 554:"New Zealand",
  528:"Netherlands", 818:"Egypt", 76:"Brazil", 566:"Nigeria",
  288:"Ghana", 686:"Senegal", 504:"Morocco", 620:"Portugal",
  826:"UK", 250:"France", 32:"Argentina", 24:"Angola",
  710:"South Africa", 643:"Russia", 578:"Norway", 124:"Canada",
  304:"Greenland",
  // Mediterranean
  724:"Spain", 380:"Italy", 300:"Greece", 792:"Turkey",
  434:"Libya", 788:"Tunisia", 12:"Algeria", 422:"Lebanon",
  376:"Israel", 191:"Croatia", 8:"Albania", 760:"Syria",
  // Red Sea / Persian Gulf
  682:"Saudi Arabia", 784:"UAE", 414:"Kuwait", 634:"Qatar",
  368:"Iraq", 232:"Eritrea", 262:"Djibouti", 729:"Sudan",
  // Caribbean
  192:"Cuba", 332:"Haiti", 214:"Dominican Republic",
  388:"Jamaica", 862:"Venezuela", 780:"Trinidad and Tobago",
  320:"Guatemala", 340:"Honduras", 558:"Nicaragua",
  // Baltic
  752:"Sweden", 208:"Denmark", 276:"Germany", 616:"Poland",
  246:"Finland", 233:"Estonia", 428:"Latvia", 440:"Lithuania",
  // Pacific additions
  458:"Malaysia", 116:"Cambodia", 626:"Timor-Leste",
  242:"Fiji", 90:"Solomon Islands", 548:"Vanuatu",
  // Atlantic additions
  120:"Cameroon", 266:"Gabon", 384:"Ivory Coast",
  204:"Benin", 768:"Togo", 430:"Liberia",
  694:"Sierra Leone", 324:"Guinea", 516:"Namibia", 478:"Mauritania",
};

// ── Binned colors — 5 quintile bins ──
const BINS = {
  slr2100:['#fef0d9','#fdcc8a','#fc8d59','#e34a33','#b30000'],
  slr2050:['#fef0d9','#fdcc8a','#fc8d59','#e34a33','#b30000'],
};
const LEGTITLES = {
  slr2100:'SLR by 2100 (cm above 1995–2014)',
  slr2050:'SLR by 2050 (cm above 1995–2014)',
};

// Basin label display names
const BASIN_LABELS = {
  'Indian':'Indian Ocean', 'Pacific':'Pacific Ocean',
  'Atlantic':'Atlantic Ocean', 'Mediterranean':'Mediterranean Sea',
  'Red Sea':'Red Sea / Persian Gulf', 'Caribbean':'Caribbean Sea',
  'Baltic':'Baltic Sea', 'Arctic':'Arctic Ocean',
};

let _Q = {};

function mval(c, m) {
  m = m || S.metric;
  if (!c) return null;
  if (m === 'slr2100') return slrAt(c, 2100);
  if (m === 'slr2050') return slrAt(c, 2050);
  return null;
}

function getQ(m) {
  if (_Q[m]) return _Q[m];
  const vs = S.countries.map(c => mval(c, m))
    .filter(v => v != null && isFinite(v)).sort((a,b) => a-b);
  const n = vs.length;
  _Q[m] = [0,.2,.4,.6,.8,1].map(q => vs[Math.min(n-1, Math.floor(q*n))]);
  return _Q[m];
}

function binColor(c) {
  const v = mval(c);
  if (v == null || !isFinite(v)) return '#d4d4d0';
  const q = getQ(S.metric), b = BINS[S.metric];
  if (v <= q[1]) return b[0];
  if (v <= q[2]) return b[1];
  if (v <= q[3]) return b[2];
  if (v <= q[4]) return b[3];
  return b[4];
}

// ── Helpers ──
function fmt(v, sfx) {
  sfx = sfx || '';
  return (v == null || !isFinite(+v)) ? '—' : d3.format('.1f')(v) + sfx;
}
function yidx(yr) {
  return !S.data ? 0 :
    Math.max(0, Math.min(S.data.years.length-1, d3.bisectCenter(S.data.years, yr)));
}
function slrAt(c, yr) { return c && c.slr_cm ? c.slr_cm[yidx(yr)] : null; }
function inBasin(c) {
  if (S.basin === 'All') return true;
  return (c.basin || '') === S.basin;
}

// ── Tooltip ──
const tipEl = document.getElementById('tip');
function showTip(html, e) {
  tipEl.innerHTML = html;
  tipEl.style.opacity = '1';
  tipEl.style.left = (e.clientX + 14) + 'px';
  tipEl.style.top  = (e.clientY + 14) + 'px';
}
function hideTip() { tipEl.style.opacity = '0'; }

// ── Map ──
function renderMap(world) {
  const svg = d3.select('#map');
  const W = svg.node().clientWidth || 1000;
  const H = svg.node().clientHeight || 600;
  svg.attr('viewBox', `0 0 ${W} ${H}`).html('');

  const geos = topojson.feature(world, world.objects.countries).features;
  geos.forEach(d => {
    const name = ISO[+d.id] || null;
    d._c = name ? (S.byName.get(name) || null) : null;
  });

  const proj = d3.geoNaturalEarth1().fitSize([W,H], {type:'FeatureCollection',features:geos});
  const path = d3.geoPath(proj);
  const g = svg.append('g');

  // Ocean background
  g.append('rect').attr('width', W).attr('height', H).attr('fill', '#ddeef6');

  // Countries
  g.selectAll('path').data(geos).join('path')
    .attr('class', d => 'country' + (d._c ? ' hd' : ''))
    .attr('d', path)
    .attr('fill', d => d._c ? binColor(d._c) : '#d4d4d0')
    .attr('stroke', d => d._c ? '#bbb' : 'none')
    .attr('stroke-width', '.3px')
    .on('mousemove', (e, d) => {
      if (d._c) {
        const c = d._c;
        showTip(
          `<b>${c.name}</b><br>` +
          `2100: <b>${fmt(slrAt(c,2100),' cm')}</b><br>` +
          `2050: ${fmt(slrAt(c,2050),' cm')}<br>` +
          `Elevation: ${c.elevation_m != null ? c.elevation_m+' m' : '—'}<br>` +
          `Pop: ${c.pop_m != null ? c.pop_m+'M' : '—'}`,
          e
        );
      } else {
        showTip('No projection data', e);
      }
    })
    .on('mouseleave', hideTip)
    .on('click', (e, d) => {
      if (!d._c) return;
      if (S.selected === d._c) { closePanel(); } else { openPanel(d._c); }
    });

  // Zoom
  S.zoom = d3.zoom().scaleExtent([1,8]).on('zoom', ev => g.attr('transform', ev.transform));
  svg.call(S.zoom);
  d3.select('#zin').on('click',    () => svg.transition().call(S.zoom.scaleBy, 1.5));
  d3.select('#zout').on('click',   () => svg.transition().call(S.zoom.scaleBy, .67));
  d3.select('#zreset').on('click', () => svg.transition().call(S.zoom.transform, d3.zoomIdentity));

  applyBasin();
  renderLeg();
}

function recolor() {
  _Q = {};
  d3.selectAll('.country').transition().duration(200)
    .attr('fill', d => d._c ? binColor(d._c) : '#d4d4d0');
  renderLeg();
  document.getElementById('ltitle').textContent = LEGTITLES[S.metric];
}

function applyBasin() {
  const filtering = S.basin !== 'All';
  d3.selectAll('.country.hd').classed('dim', d => d._c && !inBasin(d._c));
  d3.selectAll('.country:not(.hd)').classed('dim', filtering);
}

function setSel(c) {
  d3.selectAll('.country').each(function(d) {
    const isSelected = d._c === c && c !== null;
    const hasData = d._c != null;
    d3.select(this)
      .classed('sel', isSelected)
      .attr('stroke', isSelected ? '#111' : hasData ? '#bbb' : 'none')
      .attr('stroke-width', isSelected ? '1.8px' : '.3px');
  });
}

// ── Legend ──
function renderLeg() {
  const q = getQ(S.metric), bins = BINS[S.metric];
  const cont = document.getElementById('lbins');
  cont.innerHTML = '';
  bins.forEach((col, i) => {
    const d = document.createElement('div');
    d.className = 'lbin';
    d.style.background = col;
    d.title = `${fmt(q[i],' cm')} – ${fmt(q[i+1],' cm')}`;
    cont.appendChild(d);
  });
  document.getElementById('lmin').textContent = fmt(q[0], ' cm');
  document.getElementById('lmax').textContent = fmt(q[5], ' cm');
}

// ── Panel ──
function openPanel(c) {
  S.selected = c;
  setSel(c);

  const years   = S.data.years;
  const global  = S.data.global_slr_cm;
  const slr     = c.slr_cm;
  const slr30   = slrAt(c, 2030);
  const slr50   = slrAt(c, 2050);
  const slr100  = slrAt(c, 2100);
  const g100    = global[yidx(2100)];
  const diff    = (slr100 != null && g100 != null) ? slr100 - g100 : null;

  const basinLabel = BASIN_LABELS[c.basin] || (c.basin || '—');

  document.getElementById('cpname').textContent   = c.name;
  document.getElementById('cpmeta').textContent   = `${c.region || '—'}  ·  ${basinLabel}  ·  ${c.n_cells} CMIP6 grid cells`;
  document.getElementById('ig-region').textContent = c.region || '—';
  document.getElementById('ig-basin').textContent  = basinLabel;
  document.getElementById('ig-elev').textContent   = c.elevation_m != null ? c.elevation_m + ' m' : '—';
  document.getElementById('ig-pop').textContent    = c.pop_m != null ? c.pop_m + ' million' : '—';
  document.getElementById('s-2030').textContent    = fmt(slr30, ' cm');
  document.getElementById('s-2050').textContent    = fmt(slr50, ' cm');
  document.getElementById('s-2100').textContent    = fmt(slr100, ' cm');
  document.getElementById('cl-name').textContent   = c.name;

  const vsEl = document.getElementById('s-vs');
  if (diff != null) {
    vsEl.textContent = (diff >= 0 ? '+' : '') + fmt(diff, ' cm');
    vsEl.className   = 's4val ' + (diff > 1 ? 'r' : diff < -1 ? 'b' : '');
  } else {
    vsEl.textContent = '—';
    vsEl.className   = 's4val';
  }

  // Key context bullets
  const bl = [];
  if (c.elevation_m != null && c.elevation_m <= 0)
    bl.push(`Below sea level (${c.elevation_m} m avg elevation) — already at severe flood exposure`);
  else if (c.elevation_m != null && c.elevation_m < 5)
    bl.push(`Very low coastal elevation (${c.elevation_m} m) — highly sensitive to any sea level rise`);
  else if (c.elevation_m != null && c.elevation_m < 20)
    bl.push(`Low coastal elevation (${c.elevation_m} m) — coastal zones increasingly at risk`);

  if (diff != null && diff > 5)
    bl.push(`${fmt(diff,' cm')} above global mean — ${basinLabel} dynamics amplify local rise`);
  else if (diff != null && diff < -5)
    bl.push(`${fmt(Math.abs(diff),' cm')} below global mean — regional dynamics partially offset rise`);
  else if (diff != null)
    bl.push(`Close to global mean — limited regional deviation in the ${basinLabel}`);

  if (c.pop_m != null && c.pop_m > 100)
    bl.push(`Large coastal population (${c.pop_m}M) — high exposure to long-term sea level change`);

  if (slr100 != null && slr50 != null)
    bl.push(`${fmt(slr100 - slr50,' cm')} of additional rise occurs after 2050 — acceleration continues through end of century`);

  document.getElementById('cpbullets').innerHTML = bl.map(b => `<li>${b}</li>`).join('');

  // Interpretation
  const absd = diff != null ? Math.abs(diff).toFixed(1) : '—';
  const dir  = diff != null ? (diff >= 0 ? 'above' : 'below') : '';
  document.getElementById('cpinterp').innerHTML =
    `Under SSP5-8.5, <strong>${c.name}</strong> is projected to see ` +
    `<strong>${fmt(slr100,' cm')}</strong> of sea level rise by 2100 relative to the 1995–2014 baseline — ` +
    `${absd} cm ${dir} the global thermosteric mean of ${fmt(g100,' cm')}. ` +
    `This regional deviation is derived from MPI-ESM1-2-LR basin-averaged ocean surface height ` +
    `across ${c.n_cells} CMIP6 grid cells in the ${basinLabel}.`;

  drawChart(years, slr, global, c.name);
  document.getElementById('cpanel').classList.add('open');
}

function closePanel() {
  S.selected = null;
  setSel(null);
  document.getElementById('cpanel').classList.remove('open');
}

// ── Trend chart ──
function drawChart(years, slr, global, name) {
  const cont = document.getElementById('tchart');
  cont.innerHTML = '';

  const m  = {t:22, r:88, b:36, l:46};
  const W  = cont.clientWidth || 370;
  const H  = 230;
  const iW = W - m.l - m.r;
  const iH = H - m.t - m.b;

  const svg = d3.select('#tchart').append('svg')
    .attr('width', W).attr('height', H)
    .append('g').attr('transform', `translate(${m.l},${m.t})`);

  const allV = [...slr, ...global].filter(isFinite);
  const x = d3.scaleLinear().domain(d3.extent(years)).range([0, iW]);
  const y = d3.scaleLinear().domain([0, d3.max(allV) * 1.08]).nice().range([iH, 0]);
  const lg = d3.line().defined(v => isFinite(v)).curve(d3.curveMonotoneX)
    .x((_,i) => x(years[i])).y(d => y(d));

  // Small chart title (like script.js)
  svg.append('text').attr('x', 0).attr('y', -6)
    .style('font-family','IBM Plex Mono,monospace').style('font-size','8px')
    .style('fill','#bbb').style('letter-spacing','.06em')
    .text('CM ABOVE 1995–2014 BASELINE');

  // Gridlines
  svg.append('g').attr('class','grid')
    .call(d3.axisLeft(y).tickSize(-iW).tickFormat('').ticks(4));

  // Axes
  svg.append('g').attr('class','axis').attr('transform',`translate(0,${iH})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('d')));
  svg.append('g').attr('class','axis')
    .call(d3.axisLeft(y).ticks(4).tickFormat(d => d + 'cm'));

  // Global mean (dashed grey) — behind country line
  svg.append('path').datum(global).attr('fill','none')
    .attr('stroke','#999').attr('stroke-width',1.8).attr('stroke-dasharray','5,4')
    .attr('d', lg);

  // Global end label (right of chart)
  const gEnd = global[global.length-1];
  if (isFinite(gEnd)) {
    svg.append('text').attr('x', iW+6).attr('y', y(gEnd)+4)
      .style('font-family','IBM Plex Mono,monospace').style('font-size','8.5px')
      .style('fill','#999').text('global avg');
  }

  // Country line (solid blue)
  svg.append('path').datum(slr).attr('fill','none')
    .attr('stroke','#2563eb').attr('stroke-width',2.5).attr('d', lg);

  // Country end dot + label
  const vEnd = slr[slr.length-1];
  if (isFinite(vEnd)) {
    svg.append('circle').attr('cx', iW).attr('cy', y(vEnd)).attr('r', 3.5)
      .attr('fill','#2563eb');
    svg.append('text').attr('x', iW+6).attr('y', y(vEnd)+4)
      .style('font-family','IBM Plex Mono,monospace').style('font-size','8.5px')
      .style('fill','#2563eb').style('font-weight','500')
      .text(fmt(vEnd,' cm'));
  }

  // 2050 midpoint annotation on country line
  const i50 = yidx(2050), v50 = slr[i50];
  if (isFinite(v50)) {
    svg.append('circle').attr('cx', x(years[i50])).attr('cy', y(v50)).attr('r', 3)
      .attr('fill','#fff').attr('stroke','#2563eb').attr('stroke-width',1.5);
    svg.append('text')
      .attr('x', x(years[i50])).attr('y', y(v50) - 8)
      .attr('text-anchor','middle')
      .style('font-family','IBM Plex Mono,monospace').style('font-size','8px')
      .style('fill','#2563eb').text('2050: ' + fmt(v50,' cm'));
  }
}

// Name overrides — rename JSON keys to display names
const NAME_OVERRIDES = {
  'USA (California)':  'United States (California)',
  'USA (East Coast)':  'United States (East Coast)',
};

// ── Normalize data ──
function normalize(raw) {
  const years  = raw.years || [];
  const global = (raw.global_slr_cm || []).map(Number);
  const countries = Object.entries(raw.countries || {}).map(([name, d]) => ({
    name: NAME_OVERRIDES[name] || name,
    lat:         +d.lat,
    lon:         +d.lon,
    slr_cm:      (d.slr_cm || []).map(Number),
    elevation_m: d.elevation_m != null ? +d.elevation_m : null,
    pop_m:       d.pop_m != null ? +d.pop_m : null,
    region:      d.region || 'Other',
    basin:       d.basin  || 'Other',
    n_cells:     d.n_cells || 0,
  })).filter(d => d.slr_cm.length === years.length);
  return {...raw, years, global_slr_cm: global, countries};
}

// ── Search ──
function doSearch(q) {
  if (!q.trim()) return;
  const m = S.countries.find(c => c.name.toLowerCase().includes(q.toLowerCase()));
  if (m) openPanel(m);
}

// ── Init ──
async function init() {
  try {
    const [raw, world] = await Promise.all([
      d3.json('data/sea_level.json'),
      d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'),
    ]);

    S.data      = normalize(raw);
    S.countries = S.data.countries;
    S.byName    = new Map(S.countries.map(d => [d.name, d]));

    // Controls
    document.getElementById('metric').addEventListener('change', e => {
      S.metric = e.target.value;
      recolor();
    });

    document.querySelectorAll('.bb').forEach(btn => {
      btn.addEventListener('click', () => {
        const clicked = btn.dataset.basin;
        // clicking the already-active basin (non-All) resets to All
        if (clicked !== 'All' && S.basin === clicked) {
          S.basin = 'All';
          document.querySelectorAll('.bb').forEach(b =>
            b.classList.toggle('active', b.dataset.basin === 'All'));
        } else {
          S.basin = clicked;
          document.querySelectorAll('.bb').forEach(b => b.classList.toggle('active', b === btn));
        }
        applyBasin();
        if (S.selected && !inBasin(S.selected)) closePanel();
      });
    });

    const si = document.getElementById('search');
    si.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(e.target.value.trim()); });
    si.addEventListener('input',   e => { if (e.target.value.trim().length >= 2) doSearch(e.target.value.trim()); });

    document.getElementById('cpclose').addEventListener('click', closePanel);

    renderMap(world);
    document.getElementById('loading').classList.add('hidden');
    window.addEventListener('resize', () => renderMap(world));

  } catch(err) {
    console.error(err);
    document.getElementById('loading').innerHTML =
      `<p style="color:red;padding:2rem;text-align:center;max-width:400px">
        Could not load data.<br><br>
        Run <code>python -m http.server 8000</code> then open <code>http://localhost:8000</code><br><br>
        Make sure <code>data/sea_level.json</code> exists.
      </p>`;
  }
}

init();