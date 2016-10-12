import path from 'path';
import resolve from 'resolve';
import findup from 'find-up';
import forIn from 'lodash/forIn';
import topsort from './topsort';
import Addon from '../runtime/addon';

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
      addons.push(createAddonFromDirectory(pkgDir, options));
    }
  });

  // Transform into topsort-able format
  addons = addons.map((addon) => {
    let loadOptions = addon.pkg.denali || {};
    return {
      name: addon.pkg.name,
      value: addon,
      before: loadOptions.before,
      after: loadOptions.after
    };
  });

  return topsort(addons, { valueKey: 'value' });
}

/**
 * Given a directory that contains an addon, load that addon and instantiate
 * it's Addon class.
 *
 * @method createAddonFromDirectory
 * @param directory {String} path to the directory containing the addon
 * @return {Addon} the instantiated Addon class representing that directory
 * @private
 */
function createAddonFromDirectory(directory, parent) {
  let pkg = require(path.join(directory, 'package.json'));
  let AddonClass = require(path.join(directory, 'app', 'addon.js'));
  AddonClass = AddonClass.default || AddonClass || Addon;
  return new AddonClass({
    dir: directory,
    environment: parent.environment,
    container: parent.container,
    parent,
    pkg
  });
}
