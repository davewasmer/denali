import Command from '../lib/command';
import AddonBlueprint from '../blueprints/addon';

export default class AddonCommand extends Command {

  static commandName = 'addon';
  static description = 'Create a new denali addon';
  static longDescription = `
Scaffolds a new addon project. Addons are the core of Denali's extensibility,
and are bundled as node modules. This scaffold is a starting point for
developing your own addons.

For more information on using and developing addons, check out the guides:
http://denalijs.github.com/denali/guides/addons
`;

  params = [];

  flags = {};

  runsInApp = false;

  allowExtraArgs = true;

  run(args, argTokens) {
    let blueprint = new AddonBlueprint();
    blueprint.generate(this.parseArgs.call(blueprint, argTokens));
  }

}
