import fs from 'fs';
import path from 'path';
import nsp from 'nsp';
import dedent from 'dedent-js';
import escape from 'js-string-escape';
import broccoli from 'broccoli';
import { Watcher } from 'broccoli/lib';
import rimraf from 'rimraf';
import MergeTree from 'broccoli-merge-trees';
import Funnel from 'broccoli-funnel';
import BabelTree from 'broccoli-babel-transpiler';
import LintTree from 'broccoli-lint-eslint';
import { sync as copyDereferenceSync } from 'copy-dereference';
import chalk from 'chalk';
import identity from 'lodash/identity';
import ui from './ui';
import discoverAddons from '../../utils/discover-addons';
import tryRequire from '../../utils/try-require';

export default class Project {

  constructor(options) {
    this.environment = options.environment || 'development';
    this.dir = options.dir || process.cwd();
    this.lint = options.lint;
    this.audit = options.audit;

    this.addons = discoverAddons(this.dir, {
      environment: this.environment
    });
    this.buildTree = this._createBuildTree();
    this.builder = new broccoli.Builder(this.buildTree);
  }

  build(outputDir = 'dist') {
    this.startTime = process.hrtime();
    return this.builder.build()
      .then((results) => {
        this._finishBuild(results.directory, outputDir);
      }).finally(() => {
        return this.builder.cleanup();
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
    let watcher = new Watcher(this.builder, { interval: 100 });

    let onExit = () => {
      this.builder.cleanup();
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

  _createBuildTree() {
    let dirs = [ 'app', 'config', 'blueprints' ];
    if (this.environment === 'test') {
      dirs.push('test');
    }

    let sourceTrees = dirs.map((dir) => {
      return new Funnel(dir, { destDir: dir });
    });

    // We do this first because broccoli-lint-eslint is weird
    // https://github.com/ember-cli/broccoli-lint-eslint/pull/25
    if (this.lint) {
      let lintTestTrees = sourceTrees.map((dir) => {
        return new LintTree(dir, {
          testGenerator: mochaLintGenerator,
          format() {
            return '\r';
          }
        });
      });
      let lintTestTree = new MergeTree(lintTestTrees);
      lintTestTree = new Funnel(lintTestTree, { destDir: 'test/lint' });
      sourceTrees.push(lintTestTree);
    // Otherwise, just lint and move on
    } else {
      sourceTrees = sourceTrees.map((dir) => new LintTree(dir));
    }

    let tree = new MergeTree(sourceTrees);

    // Let addons have first crack at the app's build tree. They also get their
    // own absolute path passed in, in case they want to inject their own assets
    // into the app build
    this.addons.forEach((addon) => {
      let addonBuild = tryRequire(path.join(addon.dir, 'denali-build.js')) || identity;
      tree = addonBuild(tree, this, addon.dir);
    });

    // Let the app itself customize it's own build process.
    let appBuild = tryRequire(path.join(this.dir, 'denali-build.js')) || identity;
    tree = appBuild(tree, this);

    // Now the standard Denali build
    let transpiled = new Funnel(tree, {
      include: dirs.map((dir) => `${ dir }/**/*.js`),
      exlcude: ['blueprints/*/files/**']
    });
    transpiled = new BabelTree(transpiled, {
      presets: [ 'latest' ],
      plugins: [
        'transform-class-properties'
      ],
      browserPolyfill: true
    });
    return new MergeTree([ tree, transpiled ], { overwrite: true });
  }

  _finishBuild(results, outputDir) {
    rimraf.sync(outputDir);
    copyDereferenceSync(results, outputDir);
    [
      'package.json',
      'node_modules'
    ].forEach((p) => {
      fs.symlinkSync(path.join(this.dir, p), path.join(outputDir, p));
    });
    ui.info('Build successful');
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
            let module = `** ${ item.module }@${ item.version } **`;
            let recommendation = (item.recommendation || '').replace(/\n/g, ' ');
            ui.warn(`${ chalk.bold(module) } ${ chalk.reset.cyan(recommendation) }`);
          });
        }
      });
    }
  }


}

function mochaLintGenerator(relativePath, errors, results) {
  let passed = !results.errorCount || results.errorCount.length === 0;
  let messages = `${ relativePath } should pass ESLint`;

  if (results.messages) {
    messages += '\n\n';
    messages += errors.map((error) => {
      return `${ error.line }:${ error.column } - ${ error.message } (${ error.ruleId })`;
    }).join('\n');
  }

  let output = dedent`import { AssertionError } from 'must';

                      describe('ESLint | ${ escape(relativePath) }', function() {
                        it('should pass ESLint', function() {
                      `;

  if (passed) {
    output += '    // ESLint passed\n';
  } else {
    output += dedent`// ESLint failed
                     let error = new AssertionError('${ escape(messages) }');
                     error.stack = undefined;
                     throw error;
                     error.stack = undefined;
                     throw error;
`.trim();
  }
  output += `  });\n});\n`;
  return output;
}
