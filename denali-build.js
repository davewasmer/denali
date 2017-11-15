const path = require('path');
const chalk = require('chalk');
const { exec } = require('child_process');
const { AddonBuilder, ui } = require('denali-cli');

module.exports = class DenaliBuilder extends AddonBuilder {

  processSelf(tree, dir) {
    tree = this.transpileTree(tree, dir);
    return tree;
  }

  transpileTree(tree, dir) {
    // Lazy load these to avoid needing them as a full dep (this way we can keep them as devDeps)
    const { typescript: Typescript } = require('broccoli-typescript-compiler');
    const Funnel = require('broccoli-funnel');
    const MergeTree = require('broccoli-merge-trees');

    let tsconfig = require(path.join(dir, 'tsconfig.json'));
    tsconfig.baseUrl = __dirname;
    let transpiledTS = new Typescript(tree, {
      tsconfig,
      throwOnError: false,
      workingPath: __dirname,
      annotation: 'compile typescript'
    });
    transpiledTS.setDiagnosticWriter((message) => {
      ui.warn(chalk.bold(`==> [denali] Typescript compilation errors: `));
      ui.warn(message);
    });
    let withoutTS = new Funnel(tree, {
      exclude: [ '**/*.ts' ]
    });
    return new MergeTree([ withoutTS, transpiledTS ], { overwrite: true, annotation: 'merge typescript output' });
  }

};
