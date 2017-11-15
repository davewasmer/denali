import { all } from 'bluebird';
import { forEach, mapValues } from 'lodash';
import { RegisterContextual } from 'ava';
import ORMAdapter from '../data/orm-adapter';
import { ContainerOptions, Container } from '../metal/container';

export interface ContainerOverrideConfig {
  [containerSpecifier: string]: true | any;
}

export interface UnitTestContext {
  unit: UnitTest;
  container: Container;
  lookup: typeof Container.prototype.lookup;
  subject(): any;
  inject(injections: { [specifier: string]: any }): void;
  inject(name: string, value: any, options?: ContainerOptions): void;
  restore(...specifiers: string[]): void;
}

export interface UnitTestOptions {
  /**
   * If true, the container will be cleared before each test, with only your
   * supplied overrides present. If false, the container will be fully
   * populated with your app, and then your overrides applied on top of that.
   *
   * Defaults to true, and that is the recommended approach. Clearing the
   * container forces you to declare _all_ the dependencies of the module under
   * test in your unit test. If set to false, it's easy to produce leaky unit
   * tests that end up accidentally relying on container dependencies that you
   * forgot to properly mock or declare.
   */
  clearContainer?: false;
}


/**
 * The AppUnitTest class represents an app unit test. Loads up the bundle and
 * lookups up the module under test. The bundle allows for multiple concurrent
 * tests while ensuring state is not shared across them.
 *
 * @package test
 * @since 0.1.0
 */
export class UnitTest<Subject = any> {

  /**
   * A helper method for setting up an app unit test. Adds beforeEach/afterEach
   * hooks to the ava test suite which will setup and teardown the unit test.
   * They also setup a test transaction and roll it back once the test is
   * finished (for the ORM adapters that support it), so your test data won't
   * pollute the database.
   *
   * It returns the Ava test interface, but it enforces serial execution. For
   * more details, check out
   * https://gist.github.com/davewasmer/cd8ac4fad5502e9ce5c8055b283f08cb
   *
   * @since 0.1.0
   */
  static setupTest<Subject, AdditionalContext = {}>(subject: string | (() => any) = () => null, overrides: ContainerOverrideConfig = {}, options: UnitTestOptions = {}): RegisterContextual<UnitTestContext & AdditionalContext> {
    let ava = <RegisterContextual<UnitTestContext & AdditionalContext>>require('ava');
    let unitTest = new this<Subject>(subject, overrides, options);
    ava.beforeEach(async (t) => await unitTest.setup(t.context));
    ava.afterEach.always(async (t) => await unitTest.teardown());
    return <any>ava.serial;
  }

  /**
   * The container instance for this test suite
   */
  container: Container;

  /**
   * A map of container values that should be setup prior to each test run. This
   * is derived from the ContainerOverrideConfig that is passed into the
   * UnitTest constructor - it's the "allowed world" for this unit test.
   *
   * Note: don't confuse this with `originalContainerValues`, which holds the
   * value of a container entry that was overwritten by a user's `inject()`
   * call. The `originalContainerValues` is there to allow users to restore an
   * injected entry mid-test if needed. This `startingContainerValues` property
   * is for setting up the container _before_ each test.
   */
  protected startingContainerValues: { [specifier: string]: any };

  protected originalContainerValues: { [specific: string]: any } = {};

  constructor(protected _subject: string | (() => any), protected overrideConfig: ContainerOverrideConfig, options: UnitTestOptions = {}) {
    // Fetch the container for this unit test file (added during the build process)
    this.container = (<any>global).unitTestBundleContainer;
    // If the subject is pulled from the container, make sure we preserve it's value
    if (typeof _subject === 'string') {
      overrideConfig[_subject] = true;
    }
    this.applyContainerOverrideConfig(overrideConfig, options.clearContainer);
  }

  async setup(context: UnitTestContext) {
    // Setup the container with the "allowed world" for this test suite
    forEach(this.startingContainerValues, (value, specifier) => {
      this.container.register(specifier, value);
    });

    // Some shortcuts on the context object
    context.unit = this;
    context.container = this.container;
    context.subject = this.subject.bind(this);
    context.inject = this.inject.bind(this);
    context.restore = this.restore.bind(this);
    context.lookup = this.container.lookup.bind(this.container);

    // Start any database transactions we can
    await this.startTestTransactions();
  }

  /**
   * Takes the supplied override config, and updates the bundle container to
   * match it.
   *
   * @param overrideConfig Container overrides that should be used for this
   * test (see ContainerOverrideConfig)
   */
  protected applyContainerOverrideConfig(overrideConfig: ContainerOverrideConfig, clearContainer: false | undefined) {
    // Before we potentially wipe the container, grab any "passthrough" entries
    // allowed by the config
    this.startingContainerValues = mapValues(overrideConfig, (config, key) => {
      return config === true ? this.container.lookup(key, { raw: true, loose: true }) : config;
    });
    if (clearContainer !== false) {
      this.container.clear();
    }
  }

  /**
   * Returns the subject of the test. Follows container lookup rules, i.e. if
   * the entry under test is a singleton, will return the singleton instance,
   * not the class.
   *
   * @since 0.1.0
   */
  subject(): Subject {
    if (typeof this._subject === 'string') {
      return this.container.lookup(this._subject);
    }
    return this._subject();
  }

  /**
   * Overwrite an entry in the test application container. Use `restore()` to
   * restore the original container entry later. Can supply a single name and
   * value with options, or an object whose keys are specifiers and values are
   * the values to inject.
   *
   * @since 0.1.0
   */
  inject(injections: { [specifier: string]: any }): void;
  inject(name: string, value: any, options?: ContainerOptions): void;
  inject(nameOrInjections: string | { [specifier: string]: any }, value?: any, options?: ContainerOptions): void {
    let injections: { [specifier: string]: { value: any, options?: ContainerOptions } };
    if (typeof nameOrInjections === 'string') {
      let name = nameOrInjections;
      injections = { [name]: { value, options } };
    } else {
      injections = mapValues(nameOrInjections, (value) => ({ value }));
    }
    forEach(injections, ({ value, options }, specifier) => {
      this.originalContainerValues[specifier] = this.container.lookup(specifier, { raw: true, loose: true });
      this.container.register(specifier, value, options);
      this.container.clearCache(specifier);
    });
  }

  /**
   * Restore the original container entry for an entry that was previously
   * overwritten by `inject()`. If no arguments are supplied, all injections
   * are restored.
   *
   * @since 0.1.0
   */
  restore(...specifiers: string[]): void {
    if (specifiers.length === 0) {
      specifiers = Object.keys(this.originalContainerValues);
    }
    specifiers.forEach((specifier) => {
      this.container.clearCache(specifier);
      let originalValue = this.originalContainerValues[specifier];
      if (originalValue != null) {
        this.container.register(specifier, originalValue);
      }
      delete this.originalContainerValues[specifier];
    });
  }

  /**
   * Lookup all the ORM adapters, and give each one a chance to start a
   * transaction that will wrap a test, and be rolled back after
   */
  async startTestTransactions() {
    let adapters = this.container.lookupAll<ORMAdapter>('orm-adapter');
    let transactionInitializers: Promise<void>[] = [];
    forEach(adapters, (Adapter) => {
      if (typeof Adapter.startTestTransaction === 'function') {
        transactionInitializers.push(Adapter.startTestTransaction());
      }
    });
    await all(transactionInitializers);
  }

  /**
   * Roll back any test transactions started at the beginning of the test
   */
  async rollbackTestTransactions() {
    let transactionRollbacks: Promise<void>[] = [];
    let adapters = this.container.lookupAll<ORMAdapter>('orm-adapter');
    forEach(adapters, (Adapter) => {
      if (typeof Adapter.rollbackTestTransaction === 'function') {
        transactionRollbacks.push(Adapter.rollbackTestTransaction());
      }
    });
    await all(transactionRollbacks);
  }

  async teardown() {
    this.container.clear();
    await this.rollbackTestTransactions();
  }

}

export default <typeof UnitTest.setupTest>UnitTest.setupTest.bind(UnitTest);
