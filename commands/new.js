import Command from '../lib/command';
import AppBlueprint from '../blueprints/app';

export default class NewCommand extends Command {

  static commandName = 'new';
  static description = 'Create a new denali app';
  static longDescription = `
Scaffolds a new Denali application in a child directory using the given name.
Takes care of setting up a git repo and installing npm dependencies as well.
  `;

  params = [];

  flags = {};

  runsInApp = false;

  allowExtraArgs = true;

  run(args, argTokens) {
    let blueprint = new AppBlueprint();
    blueprint.generate(this.parseArgs.call(blueprint, argTokens));
  }

}
