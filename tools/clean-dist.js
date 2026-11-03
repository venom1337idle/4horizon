// clean-dist.js: empties the project's dist/ folder before a new installer is built (npm runs it by itself before "npm run dist": the "predist" script).
// So dist/ only ever holds the latest build. It only touches the dist/ folder next to package.json, never anything else.
const fs = require('fs'), path = require('path');
const dist = path.join(__dirname, '..', 'dist');
if (path.basename(dist) !== 'dist' || !fs.existsSync(path.join(__dirname, '..', 'package.json'))) { console.log('clean-dist: not the project folder, nothing done'); process.exit(0); }
let n = 0;
if (fs.existsSync(dist)) for (const name of fs.readdirSync(dist)) { fs.rmSync(path.join(dist, name), { recursive: true, force: true }); n++; }
console.log('clean-dist: dist/ emptied (' + n + ' old ' + (n === 1 ? 'item' : 'items') + ' removed)');
