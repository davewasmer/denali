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

  toTree() {
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
    let sourceTree = new MergeTree(sourceTrees, { overwrite: true });

    // Find child addons, create a builder for each, get their build trees
    let addons = discoverAddons(this.dir, { preseededAddons: this.preseededAddons });
    let addonBuilders = addons.map((addonDir) => new Builder(addonDir, this.project));
    this.project.builders = this.project.builders.concat(addonBuilders);
    let addonTrees = addonBuilders.map((builder) => builder.toTree());

    // Running processing hooks; since the addon builder code above is recursive
    // down the addon graph, by here, we have the entire addon graph in
    // this.project.builders
    this.project.builders.forEach((builder) => {
      if (builder.processEach) {
        sourceTree = builder.processEach(sourceTree, this.dir);
      }
      if (builder.processParent && addonBuilders.includes(builder)) {
        sourceTree = builder.processParent(sourceTree, this.dir);
      }
      if (builder.processApp && this.isProjectRoot) {
        sourceTree = builder.processApp(sourceTree, this.dir);
      }
    });

    if (this.processSelf) {
      sourceTree = this.processSelf(sourceTree);
    }

    // Merge the process results and the addons
    let mergedSource = new MergeTree([ ...addonTrees, sourceTree ], { overwrite: true });

    // Some special cases if this is a builder for an addon
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
