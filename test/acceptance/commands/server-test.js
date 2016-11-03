import test from 'ava';
import path from 'path';
import fs from 'fs';
import mkdirp from 'mkdirp';
import rimraf from 'rimraf';
import { CommandAcceptanceTest } from 'denali';

function linkDependency(pkgDir, dependencyName, dependencyDir) {
  let dest = path.join(pkgDir, 'node_modules', dependencyName);
  mkdirp.sync(path.dirname(dest));
  rimraf.sync(dest);
  fs.symlinkSync(dependencyDir, dest);
}

test('server command > launches a server', async () => {
  let server = new CommandAcceptanceTest('server --port 3001');

  return server.spawn({
    env: {
      DENALI_ENV: 'development'
    },
    checkOutput(stdout) {
      return stdout.indexOf('dummy@0.0.0 server up') > -1;
    }
  });
});

test('server command > launches a server based on the dummy app in an addon', async () => {
  console.log('starting test');
  let generateAddon = new CommandAcceptanceTest('addon foobar --use-npm', { populateWithDummy: false });
  console.log('generating addon');
  await generateAddon.run();
  console.log('addon generated');
  linkDependency(path.join(generateAddon.dir, 'foobar'), 'denali', generateAddon.projectRoot);
  let server = new CommandAcceptanceTest('server --port 3002', {
    dir: path.join(generateAddon.dir, 'foobar'),
    populateWithDummy: false
  });
  console.log(generateAddon.dir);
  await new Promise((resolve) => {});

  return server.spawn({
    env: {
      DENALI_ENV: 'development'
    },
    checkOutput(stdout, stderr) {
      console.log(stdout, stderr);
      return stdout.indexOf('dummy@0.0.0 server up') > -1;
    }
  });
});
