import * as RouteParser from 'route-parser';
import Action from './action';
import { Constructor } from '../utils/types';

/**
 * Extends the base RouteParser Route class with some additional properties
 * that Denali tacks on.
 *
 * @package runtime
 */
export default class Route extends RouteParser {

  /**
   * The spec for this route (just exposing this property in the type
   * definition, since the RouteParser type definitions incorrectly don't
   * include this property).
   */
  spec: string;

  /**
   * You can define static data that should be included in the `params` passed
   * to an action when you define a route in the config/routes.js file. This is
   * useful if you have a single action class whose behavior should vary based
   * on the endpoint hitting it (i.e. an authentication action whose logic is
   * identical, but needs to lookup different models based on the url)
   */
  additionalParams: any;

  /**
   * The Action class that should be invoked when a request hits this route
   */
  action: Constructor<Action>;

  /**
   * The container name of the action
   */
  actionPath: string;

}
