import dedent from 'dedent-js';
import Command from '../cli/command';
import Project from '../cli/project';

export default class BuildCommand extends Command {

  static commandName = 'build';
  static description = 'Compile your app into optimized ES5 code';
  static longDescription = dedent`
    Takes your app's ES201X source code and produces compiled, sourcemapped, and
    optimized output compatible with Node 6.`;

  params = [];

  flags = {
    environment: {
      description: 'The target environment to build for.',
      defaultValue: 'development',
      type: String
    },
    output: {
      description: 'The directory to build into',
      defaultValue: 'dist',
      type: String
    },
    watch: {
      description: 'Continuously watch the source files and rebuild on changes',
      defaultValue: false,
      type: Boolean
    }
  };

  runsInApp = true;

  run({ flags }) {
    let project = new Project({
      environment: flags.environment
    });

    if (flags.watch) {
      project.watch(flags.output);
    } else {
      project.build(flags.output);
    }
  }

}
