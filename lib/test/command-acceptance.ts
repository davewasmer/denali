import * as fs from 'fs-extra';
import * as assert from 'assert';
import * as path from 'path';
import { exec, spawn, ChildProcess } from 'child_process';
import * as tmp from 'tmp';
import * as dedent from 'dedent-js';
import * as createDebug from 'debug';
import DenaliObject from '../metal/object';

const debug = createDebug('denali:test:command-acceptance');

const MINUTE = 60 * 1000;

/**
 * A CommandAcceptanceTest allows you to test commands included in you app or addon. It makes it
 * easy to setup a clean test directory with fixture files, run your command, and test either the
 * console output of your command or the state of the filesystem after the command finishes.
 *
 * @package test
 */
export default class CommandAcceptanceTest extends DenaliObject {

  /**
   * The command to invoke, i.e. 'build' would test the invocation of '$ denali build'
   */
  command: string;

  /**
   * The test directory generated to test this command. If it's not provided to the constructor,
   * Denali will create a tmp directory inside the 'tmp' directory in your project root.
   */
  dir: string;

  /**
   * The default NODE_ENV to invoke the command with. Defaults to development.
   */
  environment: string;

  /**
   * The root directory of the project under test.
   */
  protected projectRoot: string;

  /**
   * The package.json of the project under test.
   */
  protected projectPkg: any;

  /**
   * The path to the denali executable file that will be used when invoking the command
   */
  protected denaliPath: string;

  /**
   * When testing via the `.spawn()` method, this will be the spawned ChildProcess
   */
  protected spawnedCommand: ChildProcess;

  /**
   * The interval that checks the spawn output
   */
  protected pollOutput: NodeJS.Timer;

  /**
   * A fallback timer which will fail the test if the spawned process doesn't emit passing output in
   * a certain amount of time.
   */
  protected fallbackTimeout: NodeJS.Timer;

  /**
   * @param options.dir Force the test to use this directory as the test directory. Useful if you
   *                    want to customize the fixture directory structure before running
   * @param options.name A string to include in the generated tmp directory name. Useful when
   *                     combined with the `denali test --litter` option, which will leave the tmp
   *                     directories behind, making it easier to inspect what's happening in a
   *                     CommandAcceptanceTest
   * @param options.populateWithDummy Should the test directory be populated with a copy of the
   *                                  dummy app?
   */
  constructor(command: string, options: { dir?: string, environment?: string, name?: string, populateWithDummy?: boolean } = {}) {
    super();
    this.command = command;
    this.dir = options.dir || (<any>tmp.dirSync({
      unsafeCleanup: !process.env.DENALI_LEAVE_TMP,
      prefix: `test-${ options.name || 'command-acceptance' }`
    })).name;
    this.environment = options.environment || 'development';
    this.projectRoot = path.dirname(path.dirname(process.cwd()));
    this.projectPkg = require(path.join(this.projectRoot, 'package.json'));
    // We don't use node_modules/.bin/denali because if denali-cli is linked in via yarn, it doesn't
    // add the binary symlinks to .bin. See https://github.com/yarnpkg/yarn/issues/2493
    this.denaliPath = path.join(this.projectRoot, 'node_modules', 'denali-cli', 'dist', 'bin', 'denali');

    if (options.populateWithDummy !== false) {
      this.populateWithDummy();
    }
  }

  /**
   * Copy the dummy app into our test directory
   */
  populateWithDummy(): void {
    debug(`populating tmp directory for "${ this.command }" command with dummy app`);
    let dummy = path.join(this.projectRoot, 'test', 'dummy');
    let tmpNodeModules = path.join(this.dir, 'node_modules');
    assert(!fs.existsSync(tmpNodeModules), 'You tried to run a CommandAcceptanceTest against a directory that already has an app in it. Did you forget to specify { populateWithDummy: false }?');
    // Copy over the dummy app
    fs.copySync(dummy, this.dir);
    // Symlink the addon itself as a dependency of the dummy app. The compiled dummy app will have
    // the compiled addon in it's node_modules
    fs.mkdirSync(tmpNodeModules);
    fs.readdirSync(path.join(this.projectRoot, 'node_modules')).forEach((nodeModuleEntry) => {
      fs.symlinkSync(path.join(this.projectRoot, 'node_modules', nodeModuleEntry), path.join(tmpNodeModules, nodeModuleEntry));
    });
    fs.symlinkSync(path.join(this.projectRoot, 'tmp', 'test', 'node_modules', this.projectPkg.name), path.join(tmpNodeModules, this.projectPkg.name));
    debug('tmp directory populated');
  }

  /**
   * Invoke the command and return promise that resolves with the output of the command. Useful for
   * commands that have a definitely completion (i.e. 'build', not 'serve')
   *
   * @param options.failOnStderr Should any output to stderr result in a rejected promise?
   */
  async run(options: { failOnStderr?: boolean, env?: any } = {}): Promise<{ stdout: string, stderr: string, dir: string }> {
    return new Promise<{ stdout: string, stderr: string, dir: string }>((resolve, reject) => {
      exec(`${ this.denaliPath } ${ this.command }`, {
        env: Object.assign({}, process.env, {
          NODE_ENV: this.environment
        }, options.env || {}),
        cwd: this.dir
      }, (err, stdout, stderr) => {
        if (err || (options.failOnStderr && stderr.length > 0)) {
          err = err || new Error('\n');
          err.message += dedent`
            "$ denali ${ this.command }" failed with the following output:
            ====> cwd: ${ this.dir }
            ====> stdout:
            ${ stdout }
            ====> stderr:
            ${ stderr }
          `;
          reject(err);
        } else {
          resolve({ stdout, stderr, dir: this.dir });
        }
      });
    });
  }

  /**
   * Invoke the command and poll the output every options.pollInterval. Useful for commands that
   * have a definitely completion (i.e. 'build', not 'serve'). Each poll of the output will run the
   * supplied options.checkOutput method, passing in the stdout and stderr buffers. If the
   * options.checkOutput method returns a truthy value, the returned promise will resolve.
   * Otherwise, it will continue to poll the output until options.timeout elapses, after which the
   * returned promsie will reject.
   *
   * @param options.failOnStderr Should any output to stderr result in a rejected promise?
   * @param options.checkOutput A function invoked with the stdout and stderr buffers of the invoked
   *                            command, and should return true if the output passes
   */
  async spawn(options: {
    failOnStderr?: boolean,
    env?: any,
    pollInterval?: number,
    timeout?: number,
    checkOutput(stdout: string, stderr: string, dir: string): boolean
  }): Promise<void> {
    return <any>new Promise((resolve, reject) => {

      this.spawnedCommand = spawn(this.denaliPath, this.command.split(' '), {
        env: Object.assign({}, process.env, {
          NODE_ENV: this.environment
        }, options.env || {}),
        cwd: this.dir,
        stdio: 'pipe'
      });

      // Cleanup spawned processes if our process is killed
      let cleanup = this.cleanup.bind(this);
      process.on('exit', cleanup.bind(this));

      // Buffer up the output so the polling timer can check it
      let stdoutBuffer = '';
      let stderrBuffer = '';
      this.spawnedCommand.stdout.on('data', (d) => {
        stdoutBuffer += d.toString();
      });
      this.spawnedCommand.stderr.on('data', (d) => {
        stderrBuffer += d.toString();
      });

      // Handle errors from the child process
      this.spawnedCommand.stdout.on('error', reject);
      this.spawnedCommand.stderr.on('error', reject);
      this.spawnedCommand.on('error', reject);

      // Poll periodically to check the results
      this.pollOutput = setInterval(() => {
        if (stderrBuffer.length > 0 && options.failOnStderr) {
          process.removeListener('exit', cleanup);
          this.cleanup();
          let error = new Error(`'${ this.command }' printed to stderr with failOnStderr enabled:\n`);
          error.message += dedent`
            ====> cwd: ${ this.dir }
            ====> stdout:
            ${ stdoutBuffer }
            ====> stderr:
            ${ stderrBuffer }
          `;
          reject(error);
        }
        let passed = options.checkOutput(stdoutBuffer, stderrBuffer, this.dir);
        if (passed) {
          process.removeListener('exit', cleanup);
          this.cleanup();
          resolve();
        }
      }, options.pollInterval || 50);

      // Ensure the test fails if we don't pass the test after a while
      let timeout = options.timeout || (process.env.CI ? 5 * MINUTE : 3 * MINUTE);
      this.fallbackTimeout = setTimeout(() => {
        process.removeListener('exit', cleanup);
        this.cleanup();
        let message = `Timeout of ${ (timeout / 1000) / 60 } minutes exceeded for spawned command: ${ this.command }\n`;
        message += dedent`
          ====> stdout:
          ${ stdoutBuffer }
          ====> stderr:
          ${ stderrBuffer }
        `;
        reject(new Error(message));
      }, timeout);

    });
  }

  /**
   * Internal cleanup method to clean up timers and processes.
   */
  private cleanup() {
    this.spawnedCommand.kill();
    clearInterval(this.pollOutput);
    clearTimeout(this.fallbackTimeout);
  }

}
