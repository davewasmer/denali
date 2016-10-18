import dedent from 'dedent-js';
import path from 'path';
import resolve from 'resolve';
import ui from '../cli/ui';
import Command from '../cli/command';
import forIn from 'lodash/forIn';
import padEnd from 'lodash/padEnd';

export default class RootCommand extends Command {

  hidden = true;

  params = [];

  flags = {
    version: {
      description: dedent`Print the version of Denali used in the current project,
                          or the global version if invoked outside a project`,
      type: Boolean
    },
    help: {
      description: 'Show this help message',
      type: Boolean
    }
  };

  run({ params, flags }, argTokens, commands) {
    if (flags.version) {
      this.printVersion();
    } else {
      this.printHelp(commands);
    }
  }

  printVersion() {
    let localPkg;
    try {
      let localDir = resolve.sync('denali', { basedir: process.cwd() });
      localPkg = require(path.join(localDir, '../package.json'));
    } catch (e) { /* ignore failed lookups */ }
    let globalPkg = require('../../../package.json');
    if (localPkg) {
      ui.info(`denali (local): ${ localPkg.version }`);
    }
    ui.info(`denali (global): ${ globalPkg.version }`);
    ui.info(`node: ${ process.version }`);
  }

  printHelp(commands) {
    ui.info(dedent`usage: denali [command] [args]

                   Available commands:`);

    let pad = Object.keys(commands).reduce((longest, name) => Math.max(longest, name.length), 0);

    forIn(commands, (CommandClass, name) => {
      if (CommandClass.hidden !== true) {
        ui.info(`  ${ padEnd(name, pad) }   ${ CommandClass.description }`);
      }
    });
  }

}
