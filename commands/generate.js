import fs from 'fs';
import path from 'path';
import ui from '../lib/ui';
import Command from '../lib/command';
import padEnd from 'lodash/padEnd';

export default class GenerateCommand extends Command {

  static commandName = 'generate';
  static description = 'Scaffold code for your app.';
  static longDescription = `
Generates code from the given blueprint. Blueprints are templates used by the
generate command, but they can go beyond simple templating (i.e. installing
addons).
  `;

  params = [ 'blueprintName', 'otherArgs' ];

  flags = {};

  runsInApp = true;

  allowExtraArgs = true;

  run({ params }, argTokens) {
    if (!params.blueprintName) {
      this.printHelp();
    } else {
      this.generateBlueprint(params.blueprintName, argTokens);
    }
  }

  generateBlueprint(blueprintName, argTokens) {
    const Blueprint = require(`../blueprints/${ blueprintName }`).default;
    let blueprint = new Blueprint();
    let blueprintArgs = this.parseArgs.call(blueprint, argTokens.slice(1));
    blueprint.generate(blueprintArgs);
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
