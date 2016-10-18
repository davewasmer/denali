import 'babel-polyfill';
import path from 'path';
import findup from 'findup-sync';
import ui from '../lib/ui';
import tryRequire from '../../utils/try-require';
import Project from '../lib/project';
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

// Process the command line arguments
let argTokens = process.argv.slice(2);
let project = new Project();
let commands = {};

if (isDenaliPkg) {
  let addons = project.addons;

  // Load the available addon commands by recursing through the dependency graph
  // and loading the 'commands.js' file for each addon
  addons = addons.map((details) => {
    let addonPkg = details.pkg;
    let addonDir = details.dir;
    let addonCommands = tryRequire(path.join(addonDir, 'commands'));
    // Tack on the source addon of each addon-supplied command
    forIn(addonCommands, (addonCommand) => {
      addonCommand._addon = addonPkg;
    });

    return {
      name: details.name,
      before: details.before,
      after: details.after,
      value: addonCommands
    };
  });

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

// Core commands take absolute precedence over all others
commands = assign(commands, coreCommands);

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
command._run(argTokens, project, commands);

