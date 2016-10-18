import ora from 'ora';
import Promise from 'bluebird';
import { exec } from 'child_process';
import startCase from 'lodash/startCase';
import ui from '../../cli/ui';
import Blueprint from '../../cli/blueprint';
import pkg from '../../package.json';

const run = Promise.promisify(exec);

export default class AddonBlueprint extends Blueprint {

  static blueprintName = 'addon';
  static description = 'Creates a new addon project, initializes git and installs dependencies';

  params = [ 'name' ];

  flags = {
    'skip-npm': {
      description: 'Do not run npm install on new app',
      defaultValue: false,
      type: Boolean
    }
  }

  locals({ name }) {
    return {
      name,
      className: startCase(name).replace(/\s/g, ''),
      humanizedName: startCase(name),
      denaliVersion: pkg.version
    };
  }

  postInstall({ name }, flags) {
    let spinner = ora();
    ui.info('');
    spinner.text = 'Installing npm dependencies ...';
    spinner.start();
    return Promise.resolve().then(() => {
      if (!flags['skip-npm']) {
        return run('npm install --loglevel=error', { cwd: name }).then(() => {
          spinner.stop();
          ui.success('Installing npm dependencies ... done ✔');
        });
      }
    }).then(() => {
      spinner.text = 'Setting up git repo ...';
      spinner.start();
      return run('git init', { cwd: name });
    }).then(() => {
      return run('git add .', { cwd: name });
    }).then(() => {
      return run('git commit -am "Initial denali project scaffold"', { cwd: name });
    }).then(() => {
      spinner.stop();
      ui.success('Setting up git repo ... done ✔');
      ui.success('🏔 Installation complete!');
      ui.info('');
      ui.info('To launch your application, just run:');
      ui.info('');
      ui.info(`  $ cd ${ name } && denali server`);
      ui.info('');
    });
  }

}
