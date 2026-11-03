// dist-done.js: the last line of "npm run dist" (npm runs it by itself after a successful build: the "postdist" script), so it is clear the build is over.
const fs = require('fs'), path = require('path');
const v = require('../package.json').version, exe = path.join('dist', '4horizon-Setup-' + v + '.exe');
const ok = fs.existsSync(path.join(__dirname, '..', exe));
console.log(ok ? '\n\x1b[32mDONE: installer ready: ' + exe + '\x1b[0m\n' : '\n\x1b[31mThe build ended, but ' + exe + ' was not found (see the messages above)\x1b[0m\n');
