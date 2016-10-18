import fs from 'fs';
import path from 'path';
import dedent from 'dedent-js';
import nsp from 'nsp';
import broccoli from 'broccoli';
import { Watcher } from 'broccoli/lib';
import rimraf from 'rimraf';
import MergeTree from 'broccoli-merge-trees';
import { sync as copyDereferenceSync } from 'copy-dereference';
import chalk from 'chalk';
import ui from './ui';
import Builder from './builder';
import discoverAddons from '../lib/utils/discover-addons';
import tryRequire from '../lib/utils/try-require';
import isDir from '../lib/utils/is-dir';
import eachDir from '../lib/utils/each-dir';

export default class Project {

  constructor(options) {
    this.environment = options.environment || 'development';
    this.dir = options.dir || process.cwd();
    this.projectDir = this.dir;
    this.lint = options.lint;
    this.audit = options.audit;

    let pkg = require(path.join(this.dir, 'package.json'));
    let preseededAddons = [];
    if (pkg.keywords.includes('denali-addon')) {
      preseededAddons.push(this.dir);
      this.dir = path.join(this.dir, 'test/dummy');
    }

    this.addons = discoverAddons(this.dir, {
      environment: this.environment,
      preseededAddons
    });
    this.buildTree = this._createBuildTree();
  }

  build(outputDir = 'dist') {
    this.startTime = process.hrtime();
    let broccoliBuilder = new broccoli.Builder(this.buildTree);
    return broccoliBuilder.build()
      .then((results) => {
        this._finishBuild(results.directory, outputDir);
      }).finally(() => {
        return broccoliBuilder.cleanup();
      }).catch((err) => {
        if (err.file) {
          ui.error(`File: ${ err.file }`);
        }
        ui.error(err.stack);
        ui.error('\nBuild failed');
        throw err;
      });
  }

  watch({ outputDir, onBuild }) {
    outputDir = outputDir || 'dist';
    if (fs.existsSync(outputDir)) {
      rimraf.sync(outputDir);
    }
    let broccoliBuilder = new broccoli.Builder(this.buildTree);
    let watcher = new Watcher(broccoliBuilder, { interval: 100 });

    let onExit = () => {
      broccoliBuilder.cleanup();
      process.exit(1);
    };
    process.on('SIGINT', onExit);
    process.on('SIGTERM', onExit);

    watcher.on('change', (results) => {
      this._finishBuild(results.directory, outputDir);
      onBuild();
    });

    watcher.on('error', (error) => {
      ui.error('\n\nBuild failed.');
      if (error.file) {
        if (error.line && error.column) {
          ui.error(`File: ${ error.treeDir }/${ error.file }:${ error.line }:${ error.column }`);
        } else {
          ui.error(`File: ${ error.treeDir }/${ error.file }`);
        }
      }
      if (error.message) {
        ui.error(`Error: ${ error.message }`);
      }
      if (error.stack) {
        ui.error(`Stack trace:\n${ error.stack.replace(/(^.)/mg, '  $1') }`);
      }
    });
  }

  createApplication() {
    let output = 'dist';
    return this.build(output)
      .then(() => {
        let Application = tryRequire(path.join(output, 'app/application'));
        if (!Application) {
          ui.error(`Error loading your application - expected /app/application.js to exist`);
          throw new Error('Invalid application export');
        }
        return new Application({
          dir: output,
          environment: this.environment
        });
      }).catch((error) => {
        ui.error('Error instantiating application:');
        ui.error(error.stack);
        throw error;
      });
  }

  findBlueprint(name) {
    // Search every addon plus this app, with precedence given to the app
    let blueprintOrigins = this.addons.concat([ this.dir ]);
    let allBlueprints = blueprintOrigins.reduce((blueprints, addonDir) => {
      let addonName = require(path.join(addonDir), 'package.json').name;
      let blueprintDir = path.join(addonDir, 'blueprints');
      fs.readdirSync(blueprintDir)
        .filter((filepath) => fs.statSync(filepath).isDirectory())
        .forEach((blueprintName) => {
          // Add each blueprint under it's addon namespace, and without the
          // namespace, so that the last addon (or the app) will win in case of
          // collisions.
          blueprints[`${ addonName }:${ blueprintName }`] = path.join(blueprintDir, blueprintName);
          blueprints[blueprintName] = path.join(blueprintDir, blueprintName);
        });
      return blueprints;
    }, {});
    return allBlueprints[name];
  }

  _createBuildTree() {
    // Create a builder for the app itself first, so that addons can modify it
    this.appBuilder = this._builderForDir(this.dir);
    // Create builders for each addon
    let builders = this.addons.map((dir) => this._builderForDir(dir));
    // Add the app builder last to ensure it overwrites any addon trees
    builders.push(this.appBuilder);
    let buildTrees = builders.map((builder) => builder.toTree());
    return new MergeTree(buildTrees, { overwrite: true });
  }

  _builderForDir(dir) {
    let BuilderClass;
    if (fs.existsSync(path.join(dir, 'denali-build.js'))) {
      BuilderClass = require(path.join(dir, 'denali-build.js'));
    } else {
      BuilderClass = Builder;
    }
    return new BuilderClass(dir, this, { lint: this.lint });
  }

  _finishBuild(results, outputDir) {
    rimraf.sync(outputDir);
    copyDereferenceSync(results, outputDir);
    this._linkDependencies(path.join(this.projectDir, 'node_modules'), path.join(outputDir, 'node_modules'));
    ui.info('Build successful');
    if (this.audit) {
      let pkg = path.join(this.projectDir, 'package.json');
      nsp.check({ package: pkg }, (err, vulnerabilities) => {
        if (err && [ 'ENOTFOUND', 'ECONNRESET' ].includes(err.code)) {
          ui.warn('Error trying to scan package dependencies for vulnerabilities with nsp, unable to reach server. Skipping scan ...');
          ui.warn(err);
        }
        if (vulnerabilities && vulnerabilities.length > 0) {
          ui.warn('WARNING: Some packages in your package.json may have security vulnerabilities:');
          vulnerabilities.forEach((item) => {
            let dependencyPath = item.path.join(' => ');
            let module = `*** ${ item.module }@${ item.version } ***`;
            let recommendation = (item.recommendation || '').replace(/\n/g, ' ');
            let message = dedent`${ chalk.bold.yellow(module) }
                                  Found in: ${ dependencyPath }
                                  Recommendation: ${ chalk.reset.cyan(recommendation) }`;
            ui.raw('warn', `${ message }\n`);
          });
        }
      });
    }
  }

  _linkDependencies(sourceModules, destModules) {
    if (!fs.existsSync(destModules)) {
      fs.mkdir(destModules);
    }
    eachDir(sourceModules, (moduleName) => {
      let source = path.join(sourceModules, moduleName);
      let dest = path.join(destModules, moduleName);
      try {
        fs.symlinkSync(source, dest);
      } catch (e) {
        if (e.message.match(/EEXIST/) && isDir(path.join(source, 'node_modules'))) {
          this._linkDependencies(path.join(source, 'node_modules'), path.join(dest, 'node_modules'));
        } else {
          throw e;
        }
      }
    });
  }

}
