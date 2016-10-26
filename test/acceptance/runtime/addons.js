import test from 'ava';
import fs from 'fs';
import path from 'path';
import Promise from 'bluebird';
import findup from 'findup-sync';
import rimraf from 'rimraf';
import { CommandAcceptanceTest } from 'denali';

function addDependency(pkgDir, dependency, version) {
  let pkgPath = path.join(pkgDir, 'package.json');
  let pkg = require(pkgPath);
  pkg.dependencies[dependency] = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
}

function linkDependency(pkgDir, dependencyName, dependencyDir) {
  let dest = path.join(pkgDir, 'node_modules', dependencyName);
  rimraf.sync(dest);
  fs.symlinkSync(dependencyDir, dest);
}

test('addons > load recursively', async () => {
  let options = {
    populateWithDummy: false,
    env: { DENALI_ENV: 'development' }
  };
  // Generate a nested addon graph: my-app -> my-addon -> my-nested-addon
  let app = new CommandAcceptanceTest('new my-app', options);
  let addon = new CommandAcceptanceTest('addon my-addon', options);
  let nestedAddon = new CommandAcceptanceTest('addon my-nested-addon', options);
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
  fs.writeFileSync(path.join(nestedAddonPath, 'config', 'initializers', 'my-initializer.js'), `
    export default {
      name: 'my-initializer',
      initialize() {
        console.log('foobar');
      }
    }
  `);
  // console.log(`
  //   appPath: ${ appPath }
  //   addonPath: ${ addonPath }
  //   nestedAddonPath: ${ nestedAddonPath }
  // `);
  // await new Promise((resolve) => {});

  let server = new CommandAcceptanceTest('server --port 3003', {
    dir: appPath,
    populateWithDummy: false
  });
  return server.spawn({
    env: {
      DENALI_ENV: 'development'
    },
    checkOutput(stdout) {
      console.log(stdout);
      // Do we see our signal flag from above?
      return stdout.indexOf('foobar') > -1;
    }
  });
});
