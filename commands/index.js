import fs from 'fs';
import path from 'path';
import ui from '../lib/cli/ui';
import findKey from 'lodash/findKey';
import discoverAddons from '../lib/utils/discover-addons';

export default function run(localDenaliPath) {
  let commands = {};

  // Find addon commands
  if (localDenaliPath) {
    let addons = discoverAddons(process.cwd());
    addons.forEach((addonDir) => {
      let addonCommands = discoverCommands(path.join(addonDir, 'commands'));
      commands = Object.assign(commands, addonCommands);
    });
  }

  // Core commands take precedence
  commands = Object.assign(commands, discoverCommands(__dirname));

  // Process the command line arguments
  let argTokens = process.argv.slice(2);

  // If no subcommand was supplied, then treat that as the 'root' subcommand
  let suppliedCommand;
  if (argTokens.length === 0 || argTokens[0].startsWith('-')) {
    suppliedCommand = 'root';
  } else {
    suppliedCommand = argTokens.shift();
  }

  // Find the command that best matches the supplied subcommand
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
}

function discoverCommands(dir) {
  if (!fs.existsSync(dir)) {
    return {};
  }
  return fs.readdirSync(dir).filter((filename) => {
    return fs.statSync(path.join(dir, filename)).isFile() && path.extname(filename) === '.js' && filename !== 'index.js';
  }).reduce((commands, filename) => {
    let Command = require(path.join(dir, filename)).default;
    commands[Command.commandName] = Command;
    return commands;
  }, {});
}
