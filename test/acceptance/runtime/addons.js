import test from 'ava';
import fs from 'fs';
import path from 'path';
import Promise from 'bluebird';
import findup from 'findup-sync';
import rimraf from 'rimraf';
import mkdirp from 'mkdirp';
import { CommandAcceptanceTest } from 'denali';

function addDependency(pkgDir, dependency, version) {
  let pkgPath = path.join(pkgDir, 'package.json');
  let pkg = require(pkgPath);
  pkg.dependencies[dependency] = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
}

function linkDependency(pkgDir, dependencyName, dependencyDir) {
  let dest = path.join(pkgDir, 'node_modules', dependencyName);
  mkdirp.sync(path.dirname(dest));
  rimraf.sync(dest);
  fs.symlinkSync(dependencyDir, dest);
}

test('addons > load first-level addons only', async (t) => {
  t.plan(1);

  let options = {
    populateWithDummy: false,
    env: { DENALI_ENV: 'development' }
  };
  // Generate a nested addon graph: my-app -> my-addon -> my-nested-addon
  let app = new CommandAcceptanceTest('new my-app --use-npm', options);
  let addon = new CommandAcceptanceTest('addon my-addon --use-npm', options);
  let nestedAddon = new CommandAcceptanceTest('addon my-nested-addon --use-npm', options);
  let appPath = path.join(app.dir, 'my-app');
  let addonPath = path.join(addon.dir, 'my-addon');
  let nestedAddonPath = path.join(nestedAddon.dir, 'my-nested-addon');
  await Promise.all([ app.run(), addon.run(), nestedAddon.run() ]);

  // Symlink this version of denali into each
  let denaliPath = path.dirname(path.dirname(findup('package.json')));
  linkDependency(appPath, 'denali', denaliPath);
  linkDependency(addonPath, 'denali', denaliPath);
  linkDependency(nestedAddonPath, 'denali', denaliPath);
  // Symlink the generated addons into a dependency graph, a la npm link
  addDependency(appPath, 'my-addon', '*');
  linkDependency(appPath, 'my-addon', addonPath);
  addDependency(addonPath, 'my-nested-addon', '*');
  linkDependency(addonPath, 'my-nested-addon', nestedAddonPath);
  // Add our signal flag, an initializer that just logs something out
  fs.writeFileSync(path.join(addonPath, 'config', 'initializers', 'my-initializer.js'), `
    export default {
      name: 'my-initializer',
      initialize() {
        console.log('shallow');
      }
    }
  `);
  fs.writeFileSync(path.join(nestedAddonPath, 'config', 'initializers', 'my-initializer.js'), `
    export default {
      name: 'my-initializer',
      initialize() {
        console.log('deep');
      }
    }
  `);

  let server = new CommandAcceptanceTest('server --port 3003', {
    dir: appPath,
    populateWithDummy: false
  });
  return server.spawn({
    env: {
      DENALI_ENV: 'development'
    },
    checkOutput(stdout) {
      if (stdout.indexOf('deep') > -1) {
        t.fail();
      }
      if (stdout.indexOf('shallow') > -1) {
        t.pass();
        return true;
      }
    }
  });
});
