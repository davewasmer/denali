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
    const result = this.findBlueprint(blueprintName);

    if (result) {
      try {
        let Blueprint = result.blueprint;
        let blueprint = new Blueprint({
          dir: result.path
        });
        let blueprintArgs = this.parseArgs.call(blueprint, argTokens.slice(1));
        blueprint.generate(blueprintArgs);
      } catch (e) {
        debugger;
      }
    } else {
      ui.info(`Blueprint '${ blueprintName }' doesn't exist.`);
    }
  }

  findBlueprint(name) {
    const split = name.split(':');
    const hasNamespace = split.length > 1;
    const namespace = hasNamespace ? split[0] : undefined;
    const blueprintName = hasNamespace ? split.slice(1).join(':') : split[0];
    const addons = discoverAddons(process.cwd());
    const sorted = topsort(addons);
    const blueprints = sorted.map((details) => {
      try {
        let blueprintPath = path.join(details.dir, 'blueprints', blueprintName);
        return {
          namespace: details.name,
          path: blueprintPath,
          blueprint: require(blueprintPath).default
        };
      } catch (e) {
        return false;
      }
    }).filter((blueprint) => {
      let allow = true;

      // Only allow namespaced blueprint
      if (namespace) {
        allow = blueprint.namespace === namespace;
      }

      return Boolean(blueprint) && allow;
    });

    // Add local cli blueprint if it exists
    try {
      let basePath = `../blueprints/${ blueprintName }`;
      let localBlueprint = require(basePath).default;

      blueprints.unshift({
        namespace: 'denali',
        path: basePath,
        blueprint: localBlueprint
      });
    } catch (e) {
      // noop
    }

    // Return last blueprint matched
    return blueprints.slice(-1)[0];
  }

  printHelp() {
    super.printHelp();
    ui.info('Available Blueprints:');
    let blueprints = fs.readdirSync(path.join(__dirname, '..', 'blueprints'));
    let pad = blueprints.reduce((length, name) => Math.max(length, name.length), 0);

    blueprints.forEach((blueprintName) => {
      const Blueprint = this.findBlueprint(blueprintName).blueprint;
      ui.info(`  ${ padEnd(blueprintName, pad) }  ${ Blueprint.description }`);
    });
  }

}
