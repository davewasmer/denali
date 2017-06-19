import { Command, Blueprint, unwrap } from 'denali-cli';
import * as yargs from 'yargs';

/**
 * Remove scaffolded code from your app
 *
 * @package commands
 */
export default class DestroyCommand extends Command {

  /* tslint:disable:completed-docs typedef */
  static commandName = 'destroy';
  static description = 'Remove scaffolded code from your app';
  static longDescription = unwrap`
    Removes the code generated during a \`denali generate\` command. Errs on the
    side of caution when deleting code - it will only remove files that exactly
    match the generated output. Modified files will be left untouched. `;

  static params = '<blueprint>';

  static flags = {
    skipPostUninstall: {
      description: "Don't run any post uninstall hooks for the blueprint",
      default: false,
      type: <any>'boolean'
    }
  };

  protected static configureSubcommands(commandName: string, yargs: any, projectPkg: any): yargs.Argv {
    return Blueprint.findAndConfigureBlueprints(yargs, 'destroy', projectPkg);
  }

}
