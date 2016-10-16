import Command from '../lib/command';
import Project from '../lib/project';

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
    let project = new Project({
      environment: args.environment
    });
    project.createApplication().then((application) => {
      let blueprint = application.getBlueprint('addon');
      blueprint.generate(this.parseArgs.call(blueprint, argTokens));
    });
  }

}
