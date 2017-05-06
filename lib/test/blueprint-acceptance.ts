import CommandAcceptanceTest from './command-acceptance';

/**
 * A specialized version of a CommandAcceptanceTest which tests the generate / destroy invocations
 * of a specific blueprint.
 *
 * @package test
 */
export default class BlueprintAcceptanceTest extends CommandAcceptanceTest {

  /**
   * The name of the blueprint to test
   */
  blueprintName: string;

  constructor(blueprintName: string) {
    super('');
    this.blueprintName = blueprintName;
  }

  /**
   * Run the generate command with the supplied blueprint name and return a Promise that resolves
   * when complete.
   */
  async generate(args: string) {
    this.command = `generate ${ this.blueprintName } ${ args }`;
    return this.run();
  }

  /**
   * Run the destroy command with the supplied blueprint name and return a Promise that resolves
   * when complete.
   */
  async destroy(args: string) {
    this.command = `destroy ${ this.blueprintName } ${ args }`;
    return this.run();
  }

}
