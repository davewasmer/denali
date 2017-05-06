import { ui, spinner, Command, Project } from 'denali-cli';
import unwrap from '../lib/utils/unwrap';

/**
 * Compile your app
 *
 * @package commands
 */
export default class BuildCommand extends Command {

  /* tslint:disable:completed-docs typedef */
  static commandName = 'build';
  static description = 'Compile your app';
  static longDescription = unwrap`
    Compiles your app based on your denali-build.js file, as well as any build-related addons.
  `;

  static flags = {
    environment: {
      description: 'The target environment to build for.',
      default: process.env.NODE_ENV || 'development',
      type: <any>'string'
    },
    output: {
      description: 'The directory to build into',
      default: 'dist',
      type: <any>'string'
    },
    watch: {
      description: 'Continuously watch the source files and rebuild on changes',
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
    printSlowTrees: {
      description: 'Print out an analysis of the build process, showing the slowest nodes.',
      default: false,
      type: <any>'boolean'
    }
  };

  runsInApp = true;

  async run(argv: any) {
    let project = new Project({
      environment: argv.environment,
      printSlowTrees: argv.printSlowTrees,
      lint: !argv.skipLint,
      audit: !argv.skipAudit
    });

    if (argv.watch) {
      project.watch({
        outputDir: <string>argv.output
      });
    } else {
      try {
        await project.build(argv.output);
      } catch (error) {
        await spinner.fail('Build failed');
        ui.error(error.stack);
      }
    }
  }

}
