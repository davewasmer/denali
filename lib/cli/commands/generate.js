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
    const result = this.findBlueprint(blueprintName);

    if (result) {
      let blueprint = result.instance;
      let blueprintArgs = this.parseArgs.call(blueprint, argTokens.slice(1));
      blueprint.generate(blueprintArgs);
    } else {
      ui.info(`Blueprint '${ blueprintName }' doesn't exist.`);
    }
  }

  findBlueprint(name) {
    const split = name.split(':');
    const hasNamespace = split.length > 1;
    const namespace = hasNamespace ? split[0] : undefined;
    const blueprintName = hasNamespace ? split.slice(1).join(':') : split[0];
    const addonData = discoverAddons(process.cwd());
    const addons = topsort(addonData).map((data) => {
      return new Addon(data.name, data.dir);
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
      let localBlueprint = require(basePath).default;

      blueprints.unshift({
        namespace: 'denali',
        path: basePath,
        instance: localBlueprint
      });
    } catch (e) {
      // noop
    }

    return hasNamespace ? find(blueprints, 'namespace', namespace) : blueprints.slice(-1)[0];
  }

  printHelp() {
    super.printHelp();
    const addons = discoverAddons(process.cwd());

    if (addons.length) {
      ui.info('Addon Blueprints:');
      const sorted = topsort(addons).map((data) => {
        return new Addon(data.name, data.dir);
      });
      sorted.forEach((addon) => {
        let blueprints = addon.blueprints;
        let pad = blueprints.reduce((length, item) => Math.max(length, item.name.length), 0);
        ui.info(`  ${ addon.name }:`);
        blueprints.forEach((blueprint) => {
          let impl = blueprint.instance;
          ui.info(`    ${ padEnd(blueprint.name, pad) }  ${ impl.description || '' }`);
        });
      });
      ui.info('\n');
    }


    ui.info('Denali Blueprints:');
    let blueprints = fs.readdirSync(path.join(__dirname, '..', 'blueprints'));
    let pad = blueprints.reduce((length, name) => Math.max(length, name.length), 0);

    blueprints.forEach((blueprintName) => {
      const blueprint = this.findBlueprint(blueprintName).instance;
      ui.info(`  ${ padEnd(blueprintName, pad) }  ${ blueprint.description }`);
    });
  }

}

class Addon {
  constructor(name, path) {
    this.name = name;
    this.path = path;
  }

  get blueprintNames() {
    let names = fs.readdirSync(path.join(this.path, 'blueprints'));
    return names;
  }

  get blueprints() {
    return this.blueprintNames.map((name) => {
      return new Blueprint(name, this);
    });
  }

  hasBlueprint(name) {
    const names = this.blueprintNames;
    const blueprint = names.includes(name);

    return !!blueprint;
  }

  getBlueprint(name) {
    try {
      return new Blueprint(name, this);
    } catch (e) {
      // noop
    }
  }
}

class Blueprint {
  constructor(name, addon) {
    this.name = name;
    this.addon = addon;
  }

  get instance() {
    let Print = require(this.path).default;

    if (Print) {
      return new Print({
        dir: this.path
      });
    }
  }

  get path() {
    return path.join(this.addon.path, 'blueprints', this.name);
  }

  get namespace() {
    return this.addon.name;
  }
}
