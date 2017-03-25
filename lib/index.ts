/**
 *
 * This is the main module exported by Denali when it is loaded via
 * `require/import`.
 *
 * This exports convenient shortcuts to other modules within Denali.
 * Rather than having to `import Addon from 'denali/lib/runtime/addon'`,
 * you can just `import { Addon } from 'denali'`.
 *
 */

// Data
import { attr, hasMany, hasOne, RelationshipDescriptor, Attribute } from './data/descriptors';
import Model from './data/model';
import ORMAdapter from './data/orm-adapter';
import Serializer from './data/serializer';
import FlatSerializer from './data/serializers/flat';
import JSONAPISerializer from './data/serializers/json-api';

// Metal
import Instrumentation from './metal/instrumentation';
import mixin, { createMixin, MixinFactory, MixinApplicator } from './metal/mixin';
import eachPrototype from './metal/each-prototype';
import Container from './metal/container';
import Resolver from './metal/resolver';

// Runtime
import Action from './runtime/action';
import Addon from './runtime/addon';
import Application from './runtime/application';
import Errors from './runtime/errors';
import Logger from './runtime/logger';
import Request from './runtime/request';
import Response from './runtime/response';
import Router from './runtime/router';
import Service from './runtime/service';

// Test
import appAcceptanceTest, { AppAcceptance } from './test/app-acceptance';
import BlueprintAcceptanceTest from './test/blueprint-acceptance';
import CommandAcceptanceTest from './test/command-acceptance';
import MockRequest from './test/mock-request';
import MockResponse from './test/mock-response';

export {
  attr,
  hasMany,
  hasOne,
  RelationshipDescriptor,
  Attribute,
  Model,
  ORMAdapter,
  Serializer,
  FlatSerializer,
  JSONAPISerializer,

  // Metal
  Instrumentation,
  mixin,
  createMixin,
  MixinFactory,
  MixinApplicator,
  eachPrototype,
  Container,
  Resolver,

  // Runtime
  Action,
  Addon,
  Application,
  Errors,
  Logger,
  Request,
  Response,
  Router,
  Service,

  // Test
  AppAcceptance,
  appAcceptanceTest,
  BlueprintAcceptanceTest,
  CommandAcceptanceTest,
  MockRequest,
  MockResponse
};
