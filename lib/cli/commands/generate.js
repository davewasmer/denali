import fs from 'fs';
import path from 'path';
import ui from '../lib/ui';
import Command from '../lib/command';
import discoverAddons from '../../utils/discover-addons';
import topsort from '../../utils/topsort';
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
    try {
      const Blueprint = this.findBlueprint(blueprintName).blueprint;
      let blueprint = new Blueprint();
      let blueprintArgs = this.parseArgs.call(blueprint, argTokens.slice(1));
      blueprint.generate(blueprintArgs);
    } catch (e) {
      ui.info(`Blueprint '${ blueprintName }' doesn't exist.`);
    }
  }

  findBlueprint(name) {
    const addons = discoverAddons(process.cwd());
    const sorted = topsort(addons);
    const blueprints = sorted.map((details) => {
      try {
        return {
          addon: details.name,
          blueprint: require(path.join(details.dir, 'blueprints', name)).default
        };
      } catch (e) {
        return false;
      }
    }).filter((blueprint) => !!blueprint);

    // Add local cli blueprint if it exists
    try {
      let localBlueprint = require(`../blueprints/${ name }`).default;
      blueprints.unshift({ blueprint: localBlueprint });
    } catch (e) {}

    // Return last blueprint matched
    return blueprints.slice(-1);
  }

  printHelp() {
    super.printHelp();
    ui.info('Available Blueprints:');
    let blueprints = fs.readdirSync(path.join(__dirname, '..', 'blueprints'));
    let pad = blueprints.reduce((length, name) => Math.max(length, name.length), 0);

    blueprints.forEach((blueprintName) => {
      const Blueprint = this.findBlueprint(blueprintName);
      ui.info(`  ${ padEnd(blueprintName, pad) }  ${ Blueprint.description }`);
    });
  }

}
