import fs from 'fs';
import path from 'path';
import upperFirst from 'lodash/upperFirst';
import Funnel from 'broccoli-funnel';
import MergeTree from 'broccoli-merge-trees';
import PackageTree from './package-tree';
import discoverAddons from '../utils/discover-addons';
import tryRequire from '../utils/try-require';


export default class Builder {

  constructor(dir, project, preseededAddons) {
    // Use the local denali-build.js if present
    let LocalBuilder = tryRequire(path.join(dir, 'denali-build'));
    if (LocalBuilder && this.constructor === Builder) {
      return new LocalBuilder(dir, project, preseededAddons);
    }

    this.dir = dir;
    this.pkg = require(path.join(this.dir, 'package.json'));
    this.project = project;
    this.preseededAddons = preseededAddons;
    this.dest = path.relative(project.dir, this.dir);
    if (this.isAddon && this.isProjectRoot) {
      this.dest = path.join('node_modules', this.pkg.name);
    } else if (this.dest === path.join('test', 'dummy')) {
      this.dest = '.';
    }
    this.lint = this.isProjectRoot ? project.lint : false;
    // Inherit the environment from the project, *except* when this builder is
    // representing an addon dependency and the environment is test. Basically,
    // when we run tests, we don't want addon dependencies building for test.
    this.environment = !this.isProjectRoot && project.environment === 'test'
                       ? 'development'
                       : project.environment;

    // Register with the project; this must happen before child builders are
    // created to ensure that any child addons that share this dependency will
    // use this builder, rather than attempting to create their own because none
    // existed in the project builders map.
    this.project.builders.set(dir, this);

    // Find child addons
    let addons = discoverAddons(this.dir, { preseededAddons: this.preseededAddons });
    // Build a list of child addons for the processParent hook later
    this.childBuilders = addons.map((addonDir) => this.project.builderFor(addonDir));
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

  _prepareSelf() {
    // Get the various source dirs we'll use. This is important because broccoli
    // cannot pick files at the root of the project directory.
    let dirs = this.sourceDirs();

    // Give any subclasses a chance to override the source directories by defining
    // a treeFor* method
    let sourceTrees = dirs.map((dir) => {
      let treeFor = this[`treeFor${ upperFirst(dir) }`] || this.treeFor;
      let tree = treeFor.call(this, path.join(this.dir, dir));
      if (typeof tree !== 'string' || fs.existsSync(tree)) {
        return new Funnel(tree, { annotation: dir, destDir: dir });
      }
      return false;
    }).filter(Boolean);

    // Copy the package.json file into our build output (this special tree is
    // necessary because broccoli can't pick a file from the root dir).
    sourceTrees.push(new PackageTree(this.pkg));

    // Combine everything into our unified source tree, ready for building
    return new MergeTree(sourceTrees, { overwrite: true });
  }

  toTree() {
    let tree = this._prepareSelf();

    // Run processEach hooks
    this.project.builders.forEach((builder) => {
      if (builder.processEach) {
        tree = builder.processEach(tree, this.dir);
      }
    });

    // Run processParent hooks
    this.childBuilders.forEach((builder) => {
      if (builder.processParent) {
        tree = builder.processParent(tree, this.dir);
      }
    });

    // Run processApp hooks
    if (this.isProjectRoot) {
      this.project.builders.forEach((builder) => {
        if (builder.processApp) {
          tree = builder.processApp(tree, this.dir);
        }
      });
    }

    // Run processSelf hooks
    if (this.processSelf) {
      tree = this.processSelf(tree, this.dir);
    }

    // If this is an addon, the project root, and we are building
    // for "test", we want to move the tests from the addon up to the dummy
    // app so they are actually run, but move everything else into
    // node_modules like normal.
    if (this.isAddon && this.isProjectRoot && this.environment === 'test') {
      let addonTests = new Funnel(tree, {
        include: [ 'test/**/*' ],
        exclude: [ 'test/dummy/**/*' ]
      });
      let addonWithoutTests = new Funnel(tree, {
        exclude: [ 'test/**/*' ],
        destDir: this.dest
      });
      return new MergeTree([ addonWithoutTests, addonTests ]);
    }

    return new Funnel(tree, { destDir: this.dest });
  }

}
