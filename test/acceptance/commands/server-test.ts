/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import test from 'ava';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as mkdirp from 'mkdirp';
import * as rimraf from 'rimraf';
import { CommandAcceptanceTest } from 'denali-cli';

function linkDependency(pkgDir: string, dependencyName: string, dependencyDir: string) {
  let dest = path.join(pkgDir, 'node_modules', dependencyName);
  // use fs-extra
  mkdirp.sync(path.dirname(dest));
  rimraf.sync(dest);
  fs.symlinkSync(dependencyDir, dest);
}

test('launches a server', async (t) => {
  let server = new CommandAcceptanceTest('server --port 3001', { name: 'server-command' });

  return server.spawn({
    failOnStderr: true,
    env: {
      DEBUG: null
    },
    checkOutput(stdout) {
      let started = stdout.indexOf('dummy@0.0.0 server up') > -1;
      if (started) {
        t.pass();
      }
      return started;
    }
  });
});

test('launches a server based on the dummy app in an addon', async (t) => {
  let generateAddon = new CommandAcceptanceTest('addon my-denali-addon', { name: 'server-command-dummy-app', populateWithDummy: false });
  await generateAddon.run({ failOnStderr: true });
  linkDependency(path.join(generateAddon.dir, 'my-denali-addon'), 'denali', path.join(process.cwd(), 'node_modules', 'denali'));
  let server = new CommandAcceptanceTest('server --port 3002', {
    dir: path.join(generateAddon.dir, 'my-denali-addon'),
    populateWithDummy: false
  });

  return server.spawn({
    failOnStderr: true,
    checkOutput(stdout, stderr) {
      let started = stdout.indexOf('dummy@0.0.0 server up') > -1;
      if (started) {
        t.pass();
      }
      return started;
    }
  });
});
