import dedent from 'dedent-js';
import ui from '../lib/cli/ui';
import Command from '../lib/cli/command';
import { exec } from 'child_process';

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

  run(params) {
    this.startSpinner();
    exec(`npm info ${ params.addonName }`, (err, stdout, stderr) => {
      if (err) {
        return this.fail(err);
      }
      if (stderr.length > 0) {
        if (stderr.match(/Registry returned 404/)) {
          return this.fail(`'${ params.addonName }' not found - no such npm module exists`);
        }
        return this.fail(stderr);
      }

      let pkg = JSON.parse(stdout);
      let isAddon = pkg.keywords.includes('denali-addon');
      if (!isAddon) {
        return this.fail(`${ params.addonName } is not a Denali addon.`);
      }

      this.installAddon(params.addonName);
    });
  }

  installAddon(addonName) {
    exec(`npm install --save ${ addonName }`, (err, stdout, stderr) => {
      if (err || stderr.length > 0) {
        return this.fail(err || stderr);
      }
      this.stopSpinner();
    });
  }

  fail(msg) {
    this.stopSpinner();
    ui.error(msg);
    process.exit(1);
  }

}
