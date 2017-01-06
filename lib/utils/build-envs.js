import assign from 'lodash/assign';

/**
 * Returns the default and user specified environment variables.
 *
 * @private
 * @method buildEnvs
 * @param command {Command} Used to set the default values coming from the specified command
 * @param [project] {Project} Used to set the environment of the project
 */
export default function buildEnvs(command, project) {
  let defaultEnvs = {
    PORT: command.port
  };

  if (project) {
    defaultEnvs.DENALI_ENV = project.environment;
    defaultEnvs.NODE_ENV = project.environment;
  }

  return assign({}, defaultEnvs, process.env);
}
