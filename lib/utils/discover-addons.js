import path from 'path';
import resolve from 'resolve';
import findup from 'find-up';
import forIn from 'lodash/forIn';
import topsort from './topsort';

export default function discoverAddons(dir, options = {}) {
  let addons = [];
  let pkg = require(path.join(dir, 'package.json'));

  // Instantiate (if neccessary) and load preseed addons; primarily used for
  // an addon's dummy app.
  (options.preseededAddons || []).forEach((addon) => {
    if (typeof addon === 'string') {
      addon = createAddonFromDirectory(addon);
    }
    addons.push(addon);
  });

  // Discover dependencies
  forIn(pkg.dependencies, (version, pkgName) => {
    let pkgMainPath = resolve.sync(pkgName, { basedir: dir || process.cwd() });
    let pkgJSONPath = path.resolve(findup.sync('package.json', { cwd: pkgMainPath }));
    let pkgDir = path.dirname(pkgJSONPath);
    let addonPkg = require(pkgJSONPath);
    let isDenaliAddon = addonPkg.keywords && addonPkg.keywords.includes('denali-addon');

    if (isDenaliAddon) {
      let loadOptions = addonPkg.denali || {};
      addons.push({
        name: addonPkg.name,
        dir: pkgDir,
        before: loadOptions.before,
        after: loadOptions.after
      });
    }
  });

  return topsort(addons);
}
