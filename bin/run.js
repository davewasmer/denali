require('source-map-support').install();

const path = require('path');
const resolve = require('resolve');
const findup = require('findup-sync');
const pkgPath = findup('package.json');

// No package.json found, revert to global install
if (!pkgPath) {
  require('../dist/lib/cli/commands');

// Package.json found
} else {
  let pkgDir = path.dirname(path.resolve(pkgPath));
  let localDenali;
  try {
    localDenali = resolve.sync('denali', { basedir: pkgDir });
    let localDenaliPkgDir = path.dirname(findup('package.json', { cwd: localDenali }));
    let localCommands = path.join(localDenaliPkgDir, 'dist/lib/cli/commands');
    require(localCommands);
  } catch(e) {
    require('../dist/lib/cli/commands');
  }
}
