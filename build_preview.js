// Gộp www/ thành 1 file dist/preview.html để xem thử trên trình duyệt (kèm dữ liệu giả để xem biểu đồ).
const fs = require('fs');

const html = fs.readFileSync('www/index.html', 'utf8');
// font: nhúng thẳng file woff2 vào preview (base64) để mở file lẻ vẫn đúng font
const fontsCss = fs.readFileSync('www/fonts.css', 'utf8').replace(/url\(fonts\/([^)]+)\)/g,
  (m, f) => `url(data:font/woff2;base64,${fs.readFileSync('www/fonts/' + f).toString('base64')})`);
const css = fs.readFileSync('www/styles.css', 'utf8');
// Preview dùng DỮ LIỆU GIẢ (sinh ngẫu nhiên có hạt giống cố định), không phải dữ liệu thật của ai
function demoSeed() {
  let x = 12345; const rnd = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
  const out = [], end = new Date(); end.setHours(0, 0, 0, 0);
  let w = 78;
  for (let i = 240; i >= 0; i--) {
    if (rnd() < 0.15) continue; // thỉnh thoảng quên cân
    w += (rnd() - 0.47) * 0.6;
    const d = new Date(end.getTime() - i * 86400000);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    out.push({ id: iso, date: iso, weight: Math.round(w * 10) / 10, note: rnd() < 0.05 ? 'ghi chú mẫu' : '' });
  }
  return out;
}
const seed = `window.__WT_SEED_ENTRIES__ = ${JSON.stringify(demoSeed())};`;
const js = fs.readFileSync('www/app.js', 'utf8');

const out = html
  .replace('<link rel="stylesheet" href="fonts.css">', () => `<style>\n${fontsCss}\n</style>`)
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${css}\n</style>`)
  .replace('<script src="seed-data.js"></script>', () => `<script>\n${seed}\n</script>`)
  .replace('<script src="app.js"></script>', () => `<script>\n${js}\n</script>`);

fs.writeFileSync('dist/preview.html', out);
console.log('wrote dist/preview.html, bytes:', out.length);
