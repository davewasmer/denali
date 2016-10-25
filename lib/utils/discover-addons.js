import path from 'path';
import resolve from 'resolve';
import findup from 'find-up';
import find from 'lodash/find';
import forIn from 'lodash/forIn';
import topsort from './topsort';

export default function discoverAddons(dir, options = {}) {
  options.preseededAddons = options.preseededAddons || [];
  let addons = options.preseededAddons.map((addonDir) => {
    return {
      dir: addonDir,
      pkg: require(path.join(addonDir, 'package.json'))
    };
  });

  let pkg = require(path.join(dir, 'package.json'));
  forIn(pkg.dependencies, (version, pkgName) => {
    // Ensure that we don't attempt to load a preseeded addon
    let preseedConflict = find(addons, (addon) => addon.pkg.name === pkgName);
    if (preseedConflict) {
      return;
    }
    let pkgMainPath = resolve.sync(pkgName, { basedir: dir || process.cwd() });
    let pkgJSONPath = path.resolve(findup.sync('package.json', { cwd: pkgMainPath }));
    let pkgDir = path.dirname(pkgJSONPath);
    let addonPkg = require(pkgJSONPath);
    let isDenaliAddon = addonPkg.keywords && addonPkg.keywords.includes('denali-addon');

    if (isDenaliAddon) {
      addons.push({ pkg: addonPkg, dir: pkgDir });
    }
  });

  // Transform into topsort-able format
  addons = addons.map((addon) => {
    let loadOptions = addon.pkg.denali || {};
    return {
      name: addon.pkg.name,
      value: addon.dir,
      before: loadOptions.before,
      after: loadOptions.after
    };
  });

  return topsort(addons, { valueKey: 'value' });
}
