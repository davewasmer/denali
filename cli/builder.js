import fs from 'fs';
import path from 'path';
import upperFirst from 'lodash/upperFirst';
import Funnel from 'broccoli-funnel';
import BabelTree from 'broccoli-babel-transpiler';
import MergeTree from 'broccoli-merge-trees';
import LintTree from './lint-tree';
import PackageTree from './package-tree';
import discoverAddons from '../lib/utils/discover-addons';
import tryRequire from '../lib/utils/try-require';


export default class Builder {

  constructor(dir, project, preseededAddons) {
    let LocalBuilder = tryRequire(path.join(dir, 'denali-build'));
    if (LocalBuilder && this.constructor === Builder) {
      return new LocalBuilder(dir, project, preseededAddons);
    }
    this.dir = dir;
    this.project = project;
    this.preseededAddons = preseededAddons;
    this.isRootBuilder = this.dir === project.dir;
    // Inherit the environment from the project, *except* when this builder is
    // representing an addon dependency and the environment is test. Basically,
    // when we run tests, we don't want addon dependencies building for test.
    if (!this.isRootBuilder && project.environment === 'test') {
      this.environment = 'development';
    } else {
      this.environment = project.environment;
    }
    this.lint = this.isRootBuilder ? this.lint : false;

    this.pkg = require(path.join(this.dir, 'package.json'));
    this.addons = discoverAddons(dir, { preseededAddons });
  }

  get isAddon() {
    return this.pkg.keywords && this.pkg.keywords.includes('denali-addon');
  }

  get isProjectRoot() {
    return this.project.dir === this.dir;
  }

  sourceDirs() {
    let dirs = [ 'app', 'config', 'lib' ];
    if (this.environment === 'test') {
      dirs.push('test');
    }
    return dirs;
  }

  treeFor(dir) {
    return dir;
  }

  transformSourceTree(tree) {
    return new BabelTree(tree, this.babelOptions());
  }

  babelOptions() {
    return {
      presets: [ 'latest' ],
      plugins: [
        'transform-class-properties',
        'transform-async-to-generator'
      ],
      ignore: [
        'blueprints/*/files/**',
        'test/dummy/**'
      ]
    };
  }

  treesForAddons() {
    let addons = discoverAddons(this.dir, { preseededAddons: this.preseededAddons });
    let builders = addons.map((addonDir) => new Builder(addonDir, this.project));
    let addonTrees = builders.map((builder) => builder.toTree());
    return new MergeTree(addonTrees);
  }

  toTree() {
    let dirs = this.sourceDirs();

    let sourceTrees = dirs.map((dir) => {
      let treeFor = this[`treeFor${ upperFirst(dir) }`] || this.treeFor;
      let tree = treeFor.call(this, dir);
      if (typeof tree !== 'string' || fs.existsSync(path.join(this.dir, tree))) {
        return new Funnel(path.join(this.dir, tree), { annotation: dir, destDir: dir });
      }
      return false;
    }).filter(Boolean);

    // We do this first because broccoli-lint-eslint is weird
    // https://github.com/ember-cli/broccoli-lint-eslint/pull/25
    if (this.project.lint) {
      // If it's in test environment, generate test modules for each linted file
      if (this.project.environment === 'test') {
        let lintTestTrees = sourceTrees.map((tree) => {
          return new LintTree(tree, { generateTests: true, rootDir: this.dir });
        });
        let lintTestTree = new MergeTree(lintTestTrees);
        lintTestTree = new Funnel(lintTestTree, { destDir: 'test/lint' });
        sourceTrees.push(lintTestTree);
      // Otherwise, just lint and move on
      } else {
        sourceTrees = sourceTrees.map((tree) => {
          return new LintTree(tree, { rootDir: this.dir });
        });
      }
    }

    sourceTrees = sourceTrees.map((tree) => this.transformSourceTree(tree));
    sourceTrees.push(new PackageTree(this.pkg));
    sourceTrees.push(this.treesForAddons());
    let mergedSource = new MergeTree(sourceTrees, { overwrite: true });

    if (this.isAddon) {
      // If this is an addon, the project root, and we are building
      // for "test", we want to move the tests from the addon up to the dummy
      // app so they are actually run, but move everything else into
      // node_modules like normal.
      if (this.isProjectRoot && this.environment === 'test') {
        let addonTests = new Funnel(mergedSource, { include: [ 'test/**/*' ] });
        let addonWithoutTests = new Funnel(mergedSource, {
          exclude: [ 'test/**/*' ],
          destDir: `node_modules/${ this.pkg.name }`
        });
        mergedSource = new MergeTree([ addonWithoutTests, addonTests ]);
      // If it's just any old addon, move it into the local node_modules folder
      } else {
        mergedSource = new Funnel(mergedSource, { destDir: `node_modules/${ this.pkg.name }` });
      }
    }

    return mergedSource;
  }

}
