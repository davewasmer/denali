import Builder from './lib/cli/builder';

export default class DenaliBuilder extends Builder {

  babelOptions() {
    let options = super.babelOptions(...arguments);
    if (this.environment === 'test') {
      options.plugins.push('istanbul');
    }
    return options;
  }

}
