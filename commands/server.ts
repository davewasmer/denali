import {
  clone,
  merge
} from 'lodash';
import * as fs from 'fs-extra';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { ui, Command, Project, unwrap } from 'denali-cli';
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
      description: 'Run in debug mode (add the --inspect flag to node)',
      default: false,
      type: <any>'boolean'
    },
    debugBrk: {
      description: 'Run in debug mode (add the --inspect-brk flag to node)',
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
    docs: {
      description: 'Build the documentation as well?',
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

    let project = new Project({
      environment: argv.environment,
      docs: argv.docs,
      printSlowTrees: argv.printSlowTrees
    });

    if (argv.skipBuild) {
      this.startServer(argv, project);
      return;
    }

    process.on('exit', this.cleanExit.bind(this));
    process.on('SIGINT', this.cleanExit.bind(this, true));
    process.on('SIGTERM', this.cleanExit.bind(this, true));

    let outputDir = project.isAddon ? path.join('tmp', '-dummy') : 'dist';

    if (argv.watch) {
      debug('starting watcher');
      let watch: typeof project.watch = project.isAddon ? project.watchDummy.bind(project) : project.watch.bind(project);
      watch({
        destDir: outputDir,
        afterBuild: () => {
          if (this.server) {
            debug('killing existing server');
            this.server.removeAllListeners('exit');
            this.server.kill();
          }
          this.startServer(argv, project);
        }
      });
    } else {
      debug('building project');
      project.isAddon ? await project.buildDummy(outputDir) : await project.build(outputDir);
      this.startServer(argv, project);
    }
  }

  protected cleanExit(resumeExit: boolean) {
    if (this.server) {
      this.server.kill();
    }
    if (resumeExit) {
      process.exit();
    }
  }

  protected startServer(argv: any, project: Project) {
    let bootstrapPath = project.isAddon ? path.join('test/dummy/index.js') : 'index.js';
    let args = [ bootstrapPath ];
    if (argv.debugBrk) {
      args.unshift('--inspect-brk');
    }
    if(argv.debug) {
      args.unshift('--inspect');
    }
    
    if (!fs.existsSync(bootstrapPath)) {
      throw new Error(`Unable to start your application: missing ${ bootstrapPath } file`);
    }
    debug(`starting server process: ${ process.execPath } ${ args.join(' ') }`);
    this.server = spawn(process.execPath, args, {
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
