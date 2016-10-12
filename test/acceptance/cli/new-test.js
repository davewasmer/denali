import fs from 'fs';
import path from 'path';
import expect from 'must';
import tmp from 'tmp';
import { execSync as run } from 'child_process';
import isFile from '../../../lib/utils/is-file';

function expectFile(...filepath) {
  expect(isFile(path.join(...filepath))).to.be.true();
}

let bin = path.join(__dirname, '..', '..', '..', '..', 'bin');
let denaliPath = path.join(bin, 'denali');

describe('new command', function() {

  before(function() {
    this.timeout(20000);
    this.tmpdir = tmp.dirSync({ unsafeCleanup: true });
    run(`${ denaliPath } new foobar --skip-deps`, { cwd: this.tmpdir.name });
  });

  after(function() {
    this.tmpdir.removeCallback();
  });

  it('should generate an app', function() {
    let appPath = path.join(this.tmpdir.name, 'foobar', 'app', 'application.js');
    expectFile(appPath);
    let contents = fs.readFileSync(appPath, 'utf-8');
    expect(contents).to.include('Application');
  });

});
