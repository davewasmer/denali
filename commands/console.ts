import {
  assign
} from 'lodash';
import * as repl from 'repl';
import rewrap from '../lib/utils/rewrap';
import chalk from 'chalk';
import { ui, Command, Project, unwrap } from '@denali-js/cli';

/**
 * Launch a REPL with your application loaded
 *
 * @package commands
 */
export default class ConsoleCommand extends Command {

  /* tslint:disable:completed-docs typedef */
  static commandName = 'console';
  static description = 'Launch a REPL with your application loaded';
  static longDescription = unwrap`
    Starts a REPL (Read-Eval-Print Loop) with your application initialized and
    loaded into memory. Type \`.help\` in the REPL environment for more details.`;

  static flags = {
    environment: {
      description: 'The target environment to build for.',
      default: process.env.NODE_ENV || 'development',
      type: <any>'string'
    },
    printSlowTrees: {
      description: 'Print out an analysis of the build process, showing the slowest nodes.',
      default: false,
      type: <any>'string'
    }
  };

  static runsInApp = true;

  async run(argv: any) {
    ui.info(`Loading ${ argv.environment } environment. Type '.help' for details`);
    let project = new Project({
      environment: argv.environment,
      printSlowTrees: argv.printSlowTrees
    });
    let application = await project.createApplication();
    if (application.config.get('environment') === 'production') {
      ui.warn(rewrap`WARNING: Your console is running in production environment, meaning your
      production configuration is being used. This means your app is likely connecting to live,
      production database. Use caution!`);
    }

    await application.runInitializers();

    let consoleRepl = repl.start({
      prompt: 'denali> ',
      useGlobal: true
    });

    let context = {
      application,
      container: application.container,
      lookup: application.container.lookup.bind(application.container)
    };
    assign(global, context);

    consoleRepl.defineCommand('help', function() {
      // tslint:disable-next-line:no-console
      console.log(rewrap`
        Welcome to the Denali console!

        This is a fully interactive REPL for your Denali app. That means normal JavaScript works
        here. Your application is loaded (but not started) in the background, allowing you to
        inspect the runtime state of your app.

        The following variables are availabe:

        * ${ chalk.underline('application') } - an instance of your Application class
        * ${ chalk.underline('container') } - shortcut to application.container. Use this to
          lookup the various classes associated with your app (i.e. actions, models, etc)
      `);
      this.displayPrompt();
    });
  }

}
