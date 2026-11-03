// pw.js: Playwright for the window tests. The project's own (npm install) first, a global one (npm install -g playwright) otherwise.
module.exports = (() => {
  try { return require('playwright'); } catch (e) {}
  try { return require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); } catch (e) {}
  throw new Error('Playwright is missing: run "npm install" in the project folder (then "npx playwright install chromium").');
})();
