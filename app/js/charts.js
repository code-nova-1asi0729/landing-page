/* FleetCare app — gráficos SVG sin dependencias */
(function () {
  'use strict';
  const R = window.FleetCare;

  // points: [{ label, value, tip }]
  R.lineChart = (points, opts = {}) => {
    const W = opts.width || 640, H = opts.height || 240, pl = 46, pr = 16, pt = 16, pb = 30;
    const color = opts.color || '#1E5AA8';
    if (!points.length) return R.html`<div class="chart-empty">Aún no hay datos para graficar.</div>`;
    const vals = points.map((p) => p.value);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min -= 1; max += 1; }
    const padV = (max - min) * 0.12;
    min = opts.zero ? 0 : Math.max(0, min - padV);
    max += padV;
    const x = (i) => pl + (points.length === 1 ? (W - pl - pr) / 2 : (i * (W - pl - pr)) / (points.length - 1));
    const y = (v) => pt + (1 - (v - min) / (max - min)) * (H - pt - pb);
    const fmt = opts.fmt || ((v) => R.fmtNum(v));
    const grid = [0, 1, 2, 3].map((i) => {
      const v = min + ((max - min) * i) / 3;
      return `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="#E1E6EC" stroke-dasharray="3 4"/><text x="${pl - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#8B96A3">${R.esc(fmt(v))}</text>`;
    }).join('');
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
    const area = `${line} L${x(points.length - 1).toFixed(1)} ${H - pb} L${x(0).toFixed(1)} ${H - pb} Z`;
    const step = Math.max(1, Math.ceil(points.length / 6));
    const labels = points.map((p, i) => (i % step === 0 || i === points.length - 1 ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#8B96A3">${R.esc(p.label)}</text>` : '')).join('');
    const dots = points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="${points.length > 40 ? 2 : 4}" fill="#fff" stroke="${color}" stroke-width="2"><title>${R.esc(p.tip || p.label + ': ' + fmt(p.value))}</title></circle>`).join('');
    return R.raw(`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${R.esc(opts.label || 'Gráfico de líneas')}"><defs><linearGradient id="g${color.slice(1)}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".18"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#g${color.slice(1)})"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}${labels}</svg>`);
  };

  R.spark = (values, color = '#1E5AA8') => {
    const W = 200, H = 56;
    if (values.length < 2) return R.raw(`<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"></svg>`);
    const min = Math.min(...values), max = Math.max(...values), r = max - min || 1;
    const pts = values.map((v, i) => `${((i * W) / (values.length - 1)).toFixed(1)},${(H - 6 - ((v - min) / r) * (H - 12)).toFixed(1)}`).join(' ');
    return R.raw(`<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`);
  };

  // items: [{ label, value, sub, active }]
  R.bars = (items, unit) => {
    const max = Math.max(...items.map((i) => i.value), 1);
    return R.html`<div class="bars">${items.map((i) => R.html`<div class="bar-row ${i.active ? 'is-active' : ''}"><div class="bar-head"><strong>${i.label}</strong><span>${R.fmtNum(i.value, 1)} ${unit}</span></div><div class="bar-track"><div class="bar-fill" style="width:${((i.value / max) * 100).toFixed(1)}%"></div></div>${i.sub ? R.html`<small>${i.sub}</small>` : ''}</div>`)}</div>`;
  };
})();
