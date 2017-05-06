import * as path from 'path';
import unwrap from '../lib/utils/unwrap';
import * as Bluebird from 'bluebird';
import { spinner, Command } from 'denali-cli';
import { exec, ExecOptions } from 'child_process';

const run = Bluebird.promisify<[ string, string ], string, ExecOptions>(exec);

/**
 * Publish an addon to the npm registry.
 *
 * @package commands
 */
export default class PublishCommand extends Command {

  /* tslint:disable:completed-docs typedef */
  static commandName = 'publish';
  static description = 'Publish an addon to the npm registry.';
  static longDescription = unwrap`
    Publishes an addon to the npm registry. Runs tests builds the
    addon, and publishes the dist/ directory to the registry.`;

  static runsInApp = true;

  static flags = {
    skipTests: {
      description: 'Do not run tests before publishing',
      default: false,
      type: <any>'boolean'
    }
  };

  async run(argv: any) {
    await this.build();
    if (!argv.skipTests) {
      await this.runTests();
    }
    await this.publish();
  }

  protected async runTests() {
    await spinner.start('Running tests');
    try {
      await run('npm test', {});
    } catch (error) {
      await spinner.fail('Tests failed, halting publish');
      throw error;
    }
    await spinner.succeed('Tests passed');
  }

  protected async build() {
    await spinner.start('Building');
    try {
      await run('npm run build', {});
    } catch (error) {
      await spinner.fail('Build failed, halting publish');
      throw error;
    }
    await spinner.succeed('Addon built');
  }

  protected async publish() {
    await spinner.start('Publishing');
    try {
      await run('npm publish', { cwd: path.join(process.cwd(), 'dist') });
    } catch (error) {
      await spinner.fail('Publish failed');
      throw error;
    }
    let pkg = require(path.join(process.cwd(), 'package.json'));
    await spinner.succeed(`${ pkg.name } ${ pkg.version } published!`);
  }

}
