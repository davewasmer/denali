import path from 'path';
import CliTable from 'cli-table2';
import ui from '../lib/ui';
import Command from '../lib/command';
import BuildCommand from './build';
import tryRequire from '../../utils/try-require';

export default class ConsoleCommand extends Command {

  static commandName = 'routes';
  static description = 'Display all defined routes within your application.';
  static longDescription = `
Displays routes from your application and any routes added by addons.
Display shows the method, endpoint, and the action associated to that
route.
  `;

  params = [];

  flags = {};

  runsInApp = true;

  run() {
    return BuildCommand.prototype.build.call(this).then(() => {
      let suppliedEnv = process.env.DENALI_ENV || process.env.NODE_ENV;

      process.env.DENALI_ENV = suppliedEnv || 'development';

      // TODO this command shouldn't need to be aware of /dist
      const UserApplication = tryRequire(path.join(process.cwd(), 'dist/app/application.js'));
      if (!UserApplication) {
        ui.error(`Unable to load your application - expected /app/application.js to export a subclass of Application, but found ${ UserApplication } instead.`);
        throw new Error('Invalid application export');
      }

      let application = new UserApplication({
        environment: process.env.DENALI_ENV || process.env.NODE_ENV || 'development',
        dir: path.join(process.cwd(), 'dist')
      });

      return application.runInitializers().then(() => {
        let routes = application.router.routes;
        let methods = Object.keys(routes);
        let table = new CliTable({
          head: [ 'URL', 'ACTION' ]
        });

        methods.forEach((method) => {
          let methodRoutes = routes[method];

          methodRoutes.forEach((route) => {
            // Only return routes with urls ending with a / since they are duplicated
            if (route.spec.slice(-1) === '/') {
              table.push([ `${ method.toUpperCase() } ${ route.spec }`, route.actionPath ]);
            }
          });
        });

        ui.info(table.toString());
      });
    });
  }

}
