import * as assert from 'assert';
import * as path from 'path';
import { spinner, Command, Project, unwrap } from 'denali-cli';
import * as tryRequire from 'try-require';
import * as cmdExists from 'command-exists';
import * as Bluebird from 'bluebird';
import { exec } from 'child_process';

const run = Bluebird.promisify<string, string>(exec);
const commandExists = Bluebird.promisify<boolean, string>(cmdExists);

/**
 * Run migrations to update your database schema
 *
 * @package commands
 */
export default class MigrateCommand extends Command {

  /* tslint:disable:completed-docs typedef */
  static commandName = 'migrate';
  static description = 'Run migrations to update your database schema';
  static longDescription = unwrap`
    Runs (or rolls back) schema migrations for your database. Typically only
    applies when use SQL-based databases.`;

  static flags = {
    environment: {
      description: 'The target environment to build for.',
      default: process.env.NODE_ENV || 'development',
      type: <any>'string'
    },
    rollback: {
      description: 'Rollback the latest migration, or latest --step migrations. Defaults to 1 step.',
      default: false,
      type: <any>'boolean'
    },
    redo: {
      description: 'Shortcut for rolling back then migrating up again. If used with --step, it will replay that many migrations. If used with --version, it will roll back to that version then replay. If neither, defaults to --step 1',
      default: false,
      type: <any>'boolean'
    }
  };

  static runsInApp = true;

  async run(argv: any) {
    let knex = tryRequire('knex');
    if (!knex) {
      await spinner.start('Installing knex (required for migrations)');
      let yarnExists = await commandExists('yarn');
      if (yarnExists) {
        await run('yarn add knex --mutex network');
      } else {
        await run('npm install --save knex');
      }
      knex = require('knex');
      await spinner.succeed('Knex installed');
    }
    let project = new Project({
      environment: argv.environment
    });
    let application = await project.createApplication();
    assert(application.config.migrations && application.config.migrations.db, 'DB connection info is missing. You must supply the knex connection info in config.migrations.db.');
    let db = knex(application.config.migrations.db);
    let migrationsDir = path.join(application.dir, 'config', 'migrations');
    try {
      if (argv.rollback) {
        await spinner.start('Rolling back last migration');
        await db.migrate.rollback({ directory: migrationsDir });
      } else if (argv.redo) {
        await spinner.start('Rolling back and replaying last migration');
        await db.migrate.rollback({ directory: migrationsDir });
        await db.migrate.latest({ directory: migrationsDir });
      } else {
        await spinner.start('Running migrations to latest');
        await db.migrate.latest({ directory: migrationsDir });
      }
      let newVersion = await db.migrate.currentVersion();
      await spinner.succeed(`Migrated to ${ newVersion }`);
    } catch (error) {
      await spinner.fail(`Migrations failed:\n${ error.stack }`);
    } finally {
      await db.destroy();
    }
  }

}
