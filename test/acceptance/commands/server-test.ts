/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import test from 'ava';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as mkdirp from 'mkdirp';
import * as rimraf from 'rimraf';
import { CommandAcceptanceTest } from 'denali';

function linkDependency(pkgDir: string, dependencyName: string, dependencyDir: string) {
  let dest = path.join(pkgDir, 'node_modules', dependencyName);
  // use fs-extra
  mkdirp.sync(path.dirname(dest));
  rimraf.sync(dest);
  fs.symlinkSync(dependencyDir, dest);
}

test('server command > launches a server', async () => {
  let server = new CommandAcceptanceTest('server --port 3001', { name: 'server-command' });

  return server.spawn({
    failOnStderr: true,
    env: {
      DEBUG: null
    },
    checkOutput(stdout) {
      return stdout.indexOf('dummy@0.0.0 server up') > -1;
    }
  });
});

test('server command > launches a server based on the dummy app in an addon', async () => {
  let generateAddon = new CommandAcceptanceTest('generate addon my-denali-addon', { name: 'server-command-dummy-app', populateWithDummy: false });
  let { stdout, stderr } = await generateAddon.run();
  linkDependency(path.join(generateAddon.dir, 'my-denali-addon'), 'denali', path.join(process.cwd(), 'node_modules', 'denali'));
  let server = new CommandAcceptanceTest('server --port 3002', {
    dir: path.join(generateAddon.dir, 'my-denali-addon'),
    populateWithDummy: false
  });

  return server.spawn({
    failOnStderr: true,
    checkOutput(stdout, stderr) {
      return stdout.indexOf('dummy@0.0.0 server up') > -1;
    }
  });
});
