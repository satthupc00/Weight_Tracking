// Gộp www/ thành 1 file dist/preview.html để xem thử trên trình duyệt (dùng dữ liệu trong www/seed-data.js).
const fs = require('fs');

const html = fs.readFileSync('www/index.html', 'utf8');
const css = fs.readFileSync('www/styles.css', 'utf8');
const seed = fs.readFileSync('www/seed-data.js', 'utf8');
const js = fs.readFileSync('www/app.js', 'utf8');

const out = html
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${css}\n</style>`)
  .replace('<script src="seed-data.js"></script>', () => `<script>\n${seed}\n</script>`)
  .replace('<script src="app.js"></script>', () => `<script>\n${js}\n</script>`);

fs.writeFileSync('dist/preview.html', out);
console.log('wrote dist/preview.html, bytes:', out.length);
