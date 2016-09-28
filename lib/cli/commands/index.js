import path from 'path';
import resolve from 'resolve';
import findup from 'findup-sync';
import ui from '../lib/ui';
import tryRequire from '../../utils/try-require';
import topsort from '../../utils/topsort';
import assign from 'lodash/assign';
import findKey from 'lodash/findKey';
import forIn from 'lodash/forIn';

import AddonCommand from './addon';
import BuildCommand from './build';
import ConsoleCommand from './console';
import RoutesCommand from './routes';
import RootCommand from './root';
import DestroyCommand from './destroy';
import GenerateCommand from './generate';
import InstallCommand from './install';
import NewCommand from './new';
import ServerCommand from './server';
import TestCommand from './test';

let projectPkgPath = findup('package.json');
let isDenaliPkg = false;
let projectPkg;
if (projectPkgPath) {
  projectPkg = require(path.resolve(projectPkgPath));
  isDenaliPkg = projectPkg.keywords && (projectPkg.keywords.includes('denali-addon') || projectPkg.dependencies.denali);
}

let commands = {};

if (isDenaliPkg) {
  // Load the available addon commands by recusring through the dependency graph
  // and loading the 'commands.js' file for each addon
  let addons = discoverAddons(process.cwd());
  addons = topsort(addons, { valueKey: 'value' });

  // Merge the depedency graph so that later addons take precedence over earlier
  // ones in case of conflicting command names
  commands = addons.reduce((mergedCommands, addonCommands) => {
    return assign(mergedCommands, addonCommands);
  }, {});
}

// Assemble the core commands supplied by denali itself
let coreCommands = {
  addon: AddonCommand,
  build: BuildCommand,
  console: ConsoleCommand,
  routes: RoutesCommand,
  root: RootCommand,
  destroy: DestroyCommand,
  generate: GenerateCommand,
  install: InstallCommand,
  new: NewCommand,
  server: ServerCommand,
  test: TestCommand
};

// Core commands take absolute precdence over all others
commands = assign(commands, coreCommands);

// Process the command line arguments
let argTokens = process.argv.slice(2);

// If no subcommand was supplied, then treat that as the 'root' subcommand
let suppliedCommand;
if (argTokens.length === 0 || argTokens[0].startsWith('-')) {
  suppliedCommand = 'root';
} else {
  suppliedCommand = argTokens.shift();
}

// Fspawnind the command that best matches the supplied subcommand
let fullCommandName = findKey(commands, (command, commandName) => {
  return commandName.startsWith(suppliedCommand);
});

if (!fullCommandName) {
  ui.error(`${ suppliedCommand } is not a recognized command.`);
  process.exit(1);
}

// Instantiate the request subcommand
let command = new commands[fullCommandName]();

// Invoke the command
command._run(argTokens, commands);

function discoverAddons(pkgDir, addons = []) {
  let pkg = require(path.join(pkgDir, 'package.json'));
  forIn(pkg.dependencies, (version, pkgName) => {
    let depMainPath = resolve.sync(pkgName, { basedir: pkgDir });
    let depPkgPath = findup(depMainPath, 'package.json');
    let depDir = path.dirname(depPkgPath);

    let depPkg = require(depPkgPath);
    let isDenaliAddon = depPkg.keywords && depPkg.keywords.includes('denali-addon');

    if (isDenaliAddon) {
      let loadOptions = depPkg.denali || {};

      let addonCommands = tryRequire(path.join(depDir, 'commands'));
      // Tack on the source addon of each addon-supplied command
      forIn(addonCommands, (addonCommand) => {
        addonCommand._addon = depPkg;
      });
      addons.push({
        name: depPkg.name,
        value: addonCommands,
        before: loadOptions.before,
        after: loadOptions.after
      });
      discoverAddons(depDir, addons);
    }
  });
  return addons;
}
