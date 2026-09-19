/* FleetCare app — exportación: reporte PDF (impresión) y Excel (.xlsx sin dependencias) */
(function () {
  'use strict';
  const R = window.FleetCare;

  /* ---------- XLSX mínimo (ZIP sin compresión) ---------- */
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return (bytes) => { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  })();

  function zip(files) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    const u16 = (n) => [n & 255, (n >> 8) & 255];
    const u32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
    files.forEach((f) => {
      const name = enc.encode(f.name), data = enc.encode(f.data), crc = CRC(data);
      const local = new Uint8Array([0x50, 0x4b, 3, 4, 20, 0, 0, 8, 0, 0, 0, 0, 0x21, 0, ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), 0, 0]);
      parts.push(local, name, data);
      central.push(new Uint8Array([0x50, 0x4b, 1, 2, 20, 0, 20, 0, 0, 8, 0, 0, 0, 0, 0x21, 0, ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(offset)]), name);
      offset += local.length + name.length + data.length;
    });
    const cSize = central.reduce((a, p) => a + p.length, 0);
    const end = new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(cSize), ...u32(offset), 0, 0]);
    return new Blob([...parts, ...central, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  const colName = (i) => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const xmlEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // rows: array de arrays. Números → celdas numéricas; el resto → texto.
  R.buildXlsx = (sheetName, rows, widths) => {
    const sheetRows = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
      const ref = colName(ci) + (ri + 1);
      if (v === null || v === undefined || v === '') return '';
      const style = ri === 0 ? ' s="1"' : '';
      return typeof v === 'number' && isFinite(v) ? `<c r="${ref}"${style}><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"${style}><is><t>${xmlEsc(v)}</t></is></c>`;
    }).join('')}</row>`).join('');
    const cols = widths ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    return zip([
      { name: '[Content_Types].xml', data: head + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { name: '_rels/.rels', data: head + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: head + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEsc(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
      { name: 'xl/_rels/workbook.xml.rels', data: head + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', data: head + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1E5AA8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>' },
      { name: 'xl/worksheets/sheet1.xml', data: head + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${sheetRows}</sheetData></worksheet>` },
    ]);
  };

  R.exportFuelXlsx = (db, vehicleIds) => {
    const rows = [['Fecha', 'Placa', 'Marca / Modelo', 'Litros', 'Galones', 'Monto (S/)', 'Kilometraje', 'Rendimiento (km/gal)', 'Registrado por']];
    let total = 0;
    vehicleIds.forEach((id) => {
      const v = R.vehicle(db, id);
      R.fuelSeries(db, id).forEach((f) => {
        total += 1;
        rows.push([R.fmtDate(f.date), v.plate, `${v.brand} ${v.model}`, f.liters, Math.round(f.gal * 100) / 100, f.amount, f.km, f.kmpg == null ? '' : Math.round(f.kmpg * 10) / 10, f.by || '']);
      });
    });
    if (!total) return false;
    R.download(R.buildXlsx('Combustible', rows, [12, 11, 22, 9, 10, 12, 13, 20, 20]), `fleetcare-combustible-${R.today()}.xlsx`);
    return total;
  };

  /* ---------- Reporte de mantenimiento (PDF vía impresión) ---------- */
  R.exportMaintenancePdf = (db, from, to, vehicleId) => {
    const vs = R.activeVehicles(db).filter((v) => !vehicleId || v.id === vehicleId);
    const inRange = (d) => d >= from && d <= to;
    const done = db.maintLog.filter((m) => inRange(m.date) && vs.some((v) => v.id === m.vehicleId)).sort((a, b) => (a.date < b.date ? -1 : 1));
    const faults = db.faults.filter((f) => inRange(f.date) && vs.some((v) => v.id === f.vehicleId)).sort((a, b) => (a.date < b.date ? -1 : 1));
    const plate = (id) => (R.vehicle(db, id) || {}).plate || '—';
    const table = (head, body) => `<table><thead><tr>${head.map((h) => `<th>${R.esc(h)}</th>`).join('')}</tr></thead><tbody>${body.length ? body.map((r) => `<tr>${r.map((c) => `<td>${R.esc(c)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${head.length}" class="none">Sin registros en el periodo.</td></tr>`}</tbody></table>`;
    const state = vs.map((v) => { const h = R.vehicleHealth(db, v); return [v.plate, `${v.brand} ${v.model}`, R.fmtNum(v.km) + ' km', R.statusLabel(h.status), h.causes.map((c) => c.type + ': ' + c.detail).join(' · ') || 'Sin novedades']; });
    const doc = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Reporte de mantenimiento — ${R.esc(db.company.name)}</title><style>
      body{font-family:Arial,Helvetica,sans-serif;color:#123E73;margin:32px;font-size:12px}
      header{border-bottom:3px solid #1E5AA8;padding-bottom:12px;margin-bottom:18px}
      h1{font-size:22px;margin:0 0 4px}h2{font-size:14px;margin:22px 0 8px;color:#1E5AA8;text-transform:uppercase;letter-spacing:.06em}
      p{margin:2px 0;color:#55606B}table{width:100%;border-collapse:collapse}th{background:#1E5AA8;color:#fff;text-align:left;padding:7px 8px;font-size:11px}
      td{padding:7px 8px;border-bottom:1px solid #E1E6EC;vertical-align:top}.none{color:#8B96A3;text-align:center}
      footer{margin-top:26px;color:#8B96A3;font-size:10px;border-top:1px solid #E1E6EC;padding-top:8px}
      @media print{body{margin:14mm}}</style></head><body>
      <header><h1>Reporte de mantenimiento</h1><p><strong>${R.esc(db.company.name)}</strong>${db.company.ruc ? ' · RUC ' + R.esc(db.company.ruc) : ''}</p><p>Periodo: ${R.fmtDate(from)} al ${R.fmtDate(to)} · ${vehicleId ? 'Unidad ' + R.esc(plate(vehicleId)) : vs.length + ' unidades'} · Generado el ${R.fmtDate(R.today())}</p></header>
      <h2>Estado actual de la flota</h2>${table(['Placa', 'Vehículo', 'Kilometraje', 'Estado', 'Detalle'], state)}
      <h2>Mantenimientos atendidos</h2>${table(['Fecha', 'Placa', 'Servicio', 'Kilometraje'], done.map((m) => [R.fmtDate(m.date), plate(m.vehicleId), m.service, R.fmtNum(m.km) + ' km']))}
      <h2>Fallas reportadas</h2>${table(['Fecha', 'Placa', 'Falla', 'Prioridad', 'Estado'], faults.map((f) => [R.fmtDate(f.date), plate(f.vehicleId), f.title, f.priority, R.faultStates[f.status]]))}
      <footer>Generado con FleetCare · Mantenimiento preventivo para flotas de carga ligera</footer></body></html>`;
    const ifr = document.createElement('iframe');
    ifr.setAttribute('aria-hidden', 'true');
    ifr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(ifr);
    ifr.contentDocument.open();
    ifr.contentDocument.write(doc);
    ifr.contentDocument.close();
    setTimeout(() => {
      try { ifr.contentWindow.focus(); ifr.contentWindow.print(); } catch (e) { R.toast('No se pudo abrir el diálogo de impresión.', 'error'); }
      setTimeout(() => ifr.remove(), 60000);
    }, 300);
    return { done: done.length, faults: faults.length };
  };
})();
