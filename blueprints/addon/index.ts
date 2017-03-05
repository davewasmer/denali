import * as Bluebird from 'bluebird';
import { exec, ExecOptions } from 'child_process';
import {
  startCase
} from 'lodash';
import * as cmdExists from 'command-exists';
import { Blueprint, ui, spinner } from 'denali-cli';
import * as pkg from '../../package.json';
import unwrap from '../../lib/utils/unwrap';

const run = Bluebird.promisify<[ string, string ], string, ExecOptions>(exec);
const commandExists = Bluebird.promisify<boolean, string>(cmdExists);
const ONE_KB = 1024;
const maxBuffer = 400 * ONE_KB;

/**
 * Creates a new addon project, initializes git and installs dependencies
 *
 * @package blueprints
 */
export default class AddonBlueprint extends Blueprint {

  /* tslint:disable:completed-docs typedef */
  public static blueprintName = 'addon';
  public static description = 'Creates a new addon project, initializes git and installs dependencies';
  public static longDescription = unwrap`
    Usage: denali generate addon <name> [options]

    Scaffolds a new addon. Sets up the correct directory structure, initializes a git repo, and
    installs the necessary dependencies.

    Guides: http://denali.js.org/master/guides/utilities/addons/
  `;

  public static params = '<name>';

  public static flags = {
    'skip-deps': {
      description: 'Do not install dependencies on new addon',
      defaultValue: false,
      type: <any>'boolean'
    },
    'use-npm': {
      description: 'Use npm to install dependencies, even if yarn is available',
      defaultValue: false,
      type: <any>'boolean'
    }
  };

  public locals(argv: any) {
    let name = argv.name;
    return {
      name,
      className: startCase(name).replace(/\s/g, ''),
      humanizedName: startCase(name),
      denaliVersion: pkg.version
    };
  }

  public async postInstall(argv: any) {
    let name = argv.name;
    ui.info('');
    if (!argv.skipDeps) {
      let yarnExists: boolean = await commandExists('yarn');
      if (yarnExists && !argv.useNpm) {
        await spinner.start('Installing dependencies with yarn');
        await run('yarn install --mutex network', { cwd: name, maxBuffer });
      } else {
        await spinner.start('Installing dependencies with npm');
        await run('npm install --loglevel=error', { cwd: name, maxBuffer });
      }
    }
    await spinner.succeed('Dependencies installed');
    await spinner.start('Setting up git repo');
    try {
      await run('git init', { cwd: name, maxBuffer });
      await run('git add .', { cwd: name, maxBuffer });
      await run('git commit -am "Initial denali project scaffold"', { cwd: name, maxBuffer });
      await spinner.succeed('Git repo initialized');
    } catch (e) {
      await spinner.fail('Unable to initialize git repo:');
      ui.error(e.stack);
    }
    await ui.info(`📦  ${ name } addon created!`);
  }

}
