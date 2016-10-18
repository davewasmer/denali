import dedent from 'dedent-js';
import path from 'path';
import Command from '../cli/command';
import AppBlueprint from '../blueprints/app';

export default class NewCommand extends Command {

  static commandName = 'new';
  static description = 'Create a new denali app';
  static longDescription = dedent`
    Scaffolds a new Denali application in a child directory using the given name.
    Takes care of setting up a git repo and installing npm dependencies as well.`;

  allowExtraArgs = true;

  run(args, argTokens) {
    let blueprint = new AppBlueprint(path.join(__dirname, '..', 'blueprints', 'app'));
    blueprint.generate(this.parseArgs.call(blueprint, argTokens));
  }

}
