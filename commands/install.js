import dedent from 'dedent-js';
import Promise from 'bluebird';
import commandExistsCallback from 'command-exists';
import ui from '../lib/cli/ui';
import Command from '../lib/cli/command';
import { exec } from 'child_process';

const commandExists = Promise.promisify(commandExistsCallback);
const run = Promise.promisify(exec);

export default class InstallCommand extends Command {

  static commandName = 'install';
  static description = 'Install an addon in your app.';
  static longDescription = dedent`
    Installs the supplied addon in the project. Essentially a shortcut for
    \`npm install --save <addon>\`, with sanity checking that the project actually is
    a Denali addon.`;

  runsInApp = true;

  params = [ 'addonName' ];

  flags = {};

  async run({ params }) {
    let pkgManager = await commandExists('yarn') ? 'yarn' : 'npm';
    try {
      let stdout = await run(`${ pkgManager } info ${ params.addonName } --json`);

      let pkg = JSON.parse(stdout);
      let isAddon = pkg.keywords.includes('denali-addon');
      if (!isAddon) {
        return this.fail(`${ params.addonName } is not a Denali addon.`);
      }

      this.startSpinner(`Installing ${ pkg.name }@${ pkg.version }`);
      let installCommand = pkgManager === 'yarn' ? 'yarn add --mutex network' : 'npm install --save';
      let [ , installStderr ] = await run(`${ installCommand } ${ params.addonName }`);
      ui.raw('warn', installStderr);
      this.spinner.succeed();
    } catch (err) {
      return this.fail(err);
    }
  }

  fail(msg) {
    ui.error(msg);
    this.spinner.text = 'Install failed';
    this.spinner.fail();
    process.exit(1);
  }

}
