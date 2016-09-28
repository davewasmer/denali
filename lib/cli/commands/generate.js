import fs from 'fs';
import path from 'path';
import ui from '../lib/ui';
import Command from '../lib/command';
import discoverAddons from '../../utils/discover-addons';
import topsort from '../../utils/topsort';
import padEnd from 'lodash/padEnd';
import find from 'lodash/find';


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
    const blueprint = this.findBlueprint(blueprintName);

    if (blueprint) {
      let blueprintArgs = this.parseArgs.call(blueprint, argTokens.slice(1));
      blueprint.generate(blueprintArgs);
    } else {
      ui.info(`Blueprint '${ blueprintName }' doesn't exist.`);
    }
  }

  findBlueprint(name) {
    let split = name.split(':');
    let hasNamespace = split.length > 1;
    let namespace = hasNamespace ? split[0] : undefined;
    let blueprintName = hasNamespace ? split.slice(1).join(':') : split[0];
    let addonData = discoverAddons(process.cwd());
    let addons = topsort(addonData).map((data) => {
      let addonPath = path.join(data.dir, 'app', 'addon.js');
      let Addon = require(addonPath).default;

      return new Addon({
        dir: data.dir
      });
    });
    let blueprints = addons.reduce((all, addon) => {
      if (addon.hasBlueprint(blueprintName)) {
        let blueprint = addon.getBlueprint(blueprintName);
        if (blueprint) {
          all.push(blueprint);
        }
      }

      return all;
    }, []);

    // Add local cli blueprint if it exists
    try {
      let basePath = `../blueprints/${ blueprintName }`;
      let LocalBlueprint = require(basePath).default;

      blueprints.unshift(new LocalBlueprint({
        name: blueprintName,
        addon: {
          name: 'denali',
          dir: '../'
        },
        description: LocalBlueprint.description
      }));
    } catch (e) {
      // noop
    }

    return hasNamespace ? find(blueprints, 'namespace', namespace) : blueprints.pop();
  }

  printHelp() {
    super.printHelp();
    let addonData = discoverAddons(process.cwd());

    if (addonData.length > 0) {
      ui.info('Addon Blueprints:');
      let addons = topsort(addonData).map((data) => {
        let addonPath = path.join(data.dir, 'app', 'addon.js');
        let Addon = require(addonPath).default;

        return new Addon({
          dir: data.dir
        });
      });
      addons.forEach((addon) => {
        let blueprints = addon.blueprints;
        let pad = blueprints.reduce((length, item) => Math.max(length, item.name.length), 0);
        ui.info(`  ${ addon.name }:`);
        blueprints.forEach((blueprint) => {
          ui.info(`    ${ padEnd(blueprint.name, pad) }  ${ blueprint.description || '' }`);
        });
      });
      ui.info('\n');
    }


    ui.info('Denali Blueprints:');
    let blueprints = fs.readdirSync(path.join(__dirname, '..', 'blueprints'));
    let pad = blueprints.reduce((length, name) => Math.max(length, name.length), 0);

    blueprints.forEach((blueprintName) => {
      const blueprint = this.findBlueprint(blueprintName);
      ui.info(`  ${ padEnd(blueprintName, pad) }  ${ blueprint.description }`);
    });
  }

}

