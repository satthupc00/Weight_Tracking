const fs = require('fs');

function parseCsv(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    let parts = line.split('\t');
    if (parts.length < 2) parts = line.split(',');
    if (parts.length < 2) continue;
    const clean = s => (s || '').trim().replace(/^"(.*)"$/, '$1');
    const date = clean(parts[0]);
    const weightStr = clean(parts[1]);
    const note = clean(parts[2] || '');
    const weight = parseFloat(weightStr);
    if (!date || isNaN(weight)) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    out.push({ id: date, date, weight, note });
  }
  return out;
}

const csvPath = '/root/.claude/uploads/c6c9aec5-868b-5e30-a407-e2e3a1d3f2df/8c4c6567-w-tracker-2026-09-12_18-57-34.csv';
const csv = fs.readFileSync(csvPath, 'utf8');
const LBS_PER_KG = 2.2046226218;
const seed = parseCsv(csv).map(e => ({ ...e, weight: Math.round((e.weight / LBS_PER_KG) * 10) / 10 })); // source file is in lbs

const html = fs.readFileSync('www/index.html', 'utf8');
const css = fs.readFileSync('www/styles.css', 'utf8');
const js = fs.readFileSync('www/app.js', 'utf8');

let out = html
  .replace('<link rel="stylesheet" href="styles.css">', `<style>\n${css}\n</style>`)
  .replace('<script src="app.js"></script>', `<script>\nwindow.__WT_SEED_ENTRIES__ = ${JSON.stringify(seed)};\n</script>\n<script>\n${js}\n</script>`);

fs.writeFileSync('dist/preview.html', out);
console.log('wrote dist/preview.html, bytes:', out.length, 'seed entries:', seed.length);
