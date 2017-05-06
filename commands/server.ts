import {
  clone,
  merge
} from 'lodash';
import * as fs from 'fs-extra';
import * as path from 'path';
import unwrap from '../lib/utils/unwrap';
import { spawn, ChildProcess } from 'child_process';
import { ui, Command, Project } from 'denali-cli';
import * as createDebug from 'debug';

const debug = createDebug('denali:commands:server');

/**
 * Runs the denali server for local or production use.
 *
 * @package commands
 */
export default class ServerCommand extends Command {

  /* tslint:disable:completed-docs typedef */
  static commandName = 'server';
  static description = 'Runs the denali server for local or production use.';
  static longDescription = unwrap`
    Launches the Denali server running your application.

    In a development environment, the server does several things:

     * watches your local filesystem for changes and automatically restarts for you.
     * lint your code on build
     * run a security audit of your package.json on build (via nsp)

    In production, the above features are disabled by default, and instead:

     * the server will fork worker processes to maximize CPU core usage`;

  static runsInApp = true;

  static flags = {
    environment: {
      description: 'The target environment to build for.',
      default: process.env.NODE_ENV || 'development',
      type: <any>'string'
    },
    debug: {
      description: 'Run in debug mode (add the --debug flag to node, launch node-inspector)',
      default: false,
      type: <any>'boolean'
    },
    watch: {
      description: 'Restart the server when the source files change (default: true in development)',
      type: <any>'boolean'
    },
    port: {
      description: 'The port the HTTP server should bind to (default: process.env.PORT or 3000)',
      default: process.env.PORT || 3000,
      type: <any>'number'
    },
    skipBuild: {
      description: "Don't build the app before launching the server. Useful in production if you prebuild the app before deploying. Implies --skip-lint and --skip-audit.",
      default: false,
      type: <any>'boolean'
    },
    skipLint: {
      description: 'Skip linting the app source files',
      default: false,
      type: <any>'boolean'
    },
    skipAudit: {
      description: 'Skip auditing your package.json for vulnerabilites',
      default: false,
      type: <any>'boolean'
    },
    output: {
      description: 'The directory to write the compiled app to. Defaults to a tmp directory',
      default: 'dist',
      type: <any>'string'
    },
    production: {
      description: 'Shorthand for "--skip-build --environment production"',
      default: false,
      type: <any>'boolean'
    },
    printSlowTrees: {
      description: 'Print out an analysis of the build process, showing the slowest nodes.',
      default: false,
      type: <any>'boolean'
    }
  };

  server: ChildProcess;

  async run(argv: any) {
    debug('running server command');
    if (argv.production) {
      argv.skipBuild = true;
      argv.environment = 'production';
    }
    argv.watch = argv.watch || argv.environment === 'development';

    if (argv.skipBuild) {
      this.startServer(argv);
      return;
    }

    let project = new Project({
      environment: argv.environment,
      printSlowTrees: argv.printSlowTrees,
      audit: !argv.skipAudit,
      lint: !argv.skipLint,
      buildDummy: true
    });

    process.on('exit', this.cleanExit.bind(this));
    process.on('SIGINT', this.cleanExit.bind(this));
    process.on('SIGTERM', this.cleanExit.bind(this));

    if (argv.watch) {
      debug('starting watcher');
      project.watch({
        outputDir: argv.output,
        onBuild: () => {
          if (this.server) {
            debug('killing existing server');
            this.server.removeAllListeners('exit');
            this.server.kill();
          }
          this.startServer(argv);
        }
      });
    } else {
      debug('building project');
      await project.build(argv.output);
      this.startServer(argv);
    }
  }

  protected cleanExit() {
    if (this.server) {
      this.server.kill();
    }
  }

  protected startServer(argv: any) {
    let dir = argv.output;
    let args = [ 'app/index.js' ];
    if (argv.debug) {
      args.unshift('--inspect', '--debug-brk');
    }
    if (!fs.existsSync(path.join(dir, 'app', 'index.js'))) {
      ui.error('Unable to start your application: missing app/index.js file');
      return;
    }
    debug(`starting server process: ${ process.execPath } ${ args.join(' ') }`);
    this.server = spawn(process.execPath, args, {
      cwd: dir,
      stdio: [ 'pipe', process.stdout, process.stderr ],
      env: merge(clone(process.env), {
        PORT: argv.port,
        NODE_ENV: argv.environment
      })
    });
    this.server.on('error', (error) => {
      ui.error('Unable to start your application:');
      ui.error(error.stack);
    });
    if (argv.watch) {
      this.server.on('exit', (code) => {
        let result = code === 0 ? 'exited' : 'crashed';
        ui.error(`Server ${ result }. waiting for changes to restart ...`);
      });
    }
  }

}
