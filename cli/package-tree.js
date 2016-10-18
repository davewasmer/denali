import path from 'path';
import fs from 'fs';
import Plugin from 'broccoli-plugin';

export default class PackageTree extends Plugin {

  constructor(pkg, options) {
    super([], options);
    this.pkg = pkg;
  }

  build() {
    fs.writeFileSync(path.join(this.outputPath, 'package.json'), JSON.stringify(this.pkg, null, 2));
  }

}
