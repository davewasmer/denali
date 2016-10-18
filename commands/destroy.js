import fs from 'fs';
import path from 'path';
import { padEnd } from 'lodash';
import ui from '../lib/ui';
import Command from '../lib/command';

export default class DestroyCommand extends Command {

  static commandName = 'destroy';
  static description = 'Remove scaffolded code from your app';
  static longDescription = `
Removes the code generated during a \`denali generate\` command. Errs on the
side of caution when deleting code - it will only remove files that exactly
match the generated output. Modified files will be left untouched.
  `;

  params = [ 'blueprintName', 'otherArgs' ];

  flags = {};

  runsInApp = true;

  allowExtraArgs = true;

  run({ params }, argTokens) {
    if (!params.blueprintName) {
      this.printHelp();
    } else {
      this.destroyBlueprint(params.blueprintName, argTokens);
    }
  }

  destroyBlueprint(blueprintName, argTokens) {
    const Blueprint = require(`../blueprints/${ blueprintName }`).default;
    let blueprint = new Blueprint();
    let blueprintArgs = this.parseArgs.call(blueprint, argTokens.slice(1));
    blueprint.destroy(blueprintArgs);
  }

  printHelp() {
    super.printHelp();
    ui.info('Available Blueprints:');
    let blueprints = fs.readdirSync(path.join(__dirname, '..', 'blueprints'));
    let pad = blueprints.reduce((length, name) => Math.max(length, name.length), 0);
    blueprints.forEach((blueprintName) => {
      const Blueprint = require(`../blueprints/${ blueprintName }`).default;
      ui.info(`  ${ padEnd(blueprintName, pad) }  ${ Blueprint.description }`);
    });
  }

}
