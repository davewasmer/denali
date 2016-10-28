import fs from 'fs';
import path from 'path';
import dedent from 'dedent-js';
import nsp from 'nsp';
import broccoli from 'broccoli';
import { Watcher } from 'broccoli/lib';
import rimraf from 'rimraf';
import printSlowNodes from 'broccoli-slow-trees';
import { sync as copyDereferenceSync } from 'copy-dereference';
import chalk from 'chalk';
import ui from './ui';
import Builder from './builder';
import discoverAddons from '../utils/discover-addons';
import tryRequire from '../utils/try-require';
import isDir from '../utils/is-dir';
import eachDir from '../utils/each-dir';

export default class Project {

  constructor(options = {}) {
    this.environment = options.environment || 'development';
    this.printSlowTrees = options.printSlowTrees || false;
    this.dir = options.dir || process.cwd();
    this.lint = options.lint;
    this.audit = options.audit;

    this.pkg = require(path.join(this.dir, 'package.json'));
    let buildPath = this.isAddon ? path.join(this.dir, 'test', 'dummy') : this.dir;
    let preseededAddons = this.isAddon ? [ this.dir ] : [];
    let builder = new Builder(buildPath, this, preseededAddons);
    this.buildTree = builder.toTree();
  }

  get isAddon() {
    return this.pkg.keywords && this.pkg.keywords.includes('denali-addon');
  }

  build(outputDir = 'dist') {
    if (!path.isAbsolute(outputDir)) {
      outputDir = path.join(process.cwd(), outputDir);
    }
    this.startTime = process.hrtime();
    let broccoliBuilder = new broccoli.Builder(this.buildTree);
    return broccoliBuilder.build()
      .then((results) => {
        this._finishBuild(results, outputDir);
      }).finally(() => {
        return broccoliBuilder.cleanup();
      }).then(() => {
        return outputDir;
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
      this._finishBuild(results, outputDir);
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
    return this.build().then((outputDir) => {
      let Application = tryRequire(path.join(outputDir, 'app', 'application'));
      if (!Application) {
        throw new Error('Denali was unable to load app/application.js.');
      }
      return new Application({
        dir: outputDir,
        environment: this.environment
      });
    }).catch((error) => {
      ui.error(error.stack);
      throw error;
    });
  }

  findBlueprint(name) {
    this.addons = discoverAddons(this.dir, {
      environment: this.environment,
      recurse: false,
      preseededAddons: this.isAddon ? [ this.dir ] : null
    });
    // Search every addon plus this app, with precedence given to the app
    let blueprintOrigins = this.addons.concat([ this.dir ]);
    let allBlueprints = blueprintOrigins.reduce((blueprints, originDir) => {
      let addonName = require(path.join(originDir, 'package.json')).name;
      let blueprintDir = path.join(originDir, 'blueprints');
      if (isDir(blueprintDir)) {
        fs.readdirSync(blueprintDir)
        .filter((filepath) => fs.statSync(path.join(blueprintDir, filepath)).isDirectory())
        .forEach((blueprintName) => {
          // Add each blueprint under it's addon namespace, and without the
          // namespace, so that the last addon (or the app) will win in case of
          // collisions.
          blueprints[`${ addonName }:${ blueprintName }`] = path.join(blueprintDir, blueprintName);
          blueprints[blueprintName] = path.join(blueprintDir, blueprintName);
        });
      }
      return blueprints;
    }, {});
    return allBlueprints[name];
  }

  _finishBuild(results, outputDir) {
    rimraf.sync(outputDir);
    copyDereferenceSync(results.directory, outputDir);
    this._linkDependencies(path.join(this.dir, 'node_modules'), path.join(outputDir, 'node_modules'));
    if (this.printSlowTrees) {
      printSlowNodes(results.graph);
    }
    if (this.audit) {
      let pkg = path.join(this.dir, 'package.json');
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
        if (e.message.match(/EEXIST/)) {
          if (isDir(path.join(source, 'node_modules'))) {
            if (!isDir(path.join(dest, 'node_modules'))) {
              fs.mkdirSync(path.join(dest, 'node_modules'));
            }
            this._linkDependencies(path.join(source, 'node_modules'), path.join(dest, 'node_modules'));
          }
        } else {
          throw e;
        }
      }
    });
  }

}
