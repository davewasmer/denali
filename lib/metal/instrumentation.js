import EventEmitter from 'events';
import Promise from 'bluebird';

/**
 * The Instrumentation class is a low level class for instrumenting your app's
 * code. It allows you to listen to framework level profiling events, as well
 * as creating and firing your own such events.
 *
 * For example, if you wanted to instrument how long a particular action was taking:
 *
 *     import { Instrumentation, Action } from 'denali';
 *     export default class MyAction extends Action {
 *       respond() {
 *         let Post = this.modelFor('post');
 *         return Instrumentation.instrument('post lookup', { currentUser: this.user.id }, () => {
 *           Post.find({ user: this.user });
 *         });
 *       }
 *     }
 *
 * @class Instrumentation
 * @static
 * @module denali
 * @submodule metal
 */
export default {

  /**
   * The internal event emitter used for notifications
   *
   * @property _emitter
   * @type {events.EventEmitter}
   */
  _emitter: new EventEmitter(),

  /**
   * Subscribe to be notified when a particular instrumentation block completes.
   *
   * @method subscribe
   * @param eventName {String}
   * @param listener {Function}
   */
  subscribe() {
    this._emitter.on(...arguments);
  },

  /**
   * Unsubscribe from being notified when a particular instrumentation
   * block completes.
   *
   * @method unsubscribe
   * @param eventName {String}
   * @param listener {Function}
   */
  unsubscribe() {
    this._emitter.removeListener(...arguments);
  },

  /**
   * Run the supplied function, timing how long it takes to complete. If the
   * function returns a promise, the timer waits until that promise resolves.
   * Returns a promise that resolves with the return value of the supplied
   * function. Fires an event with the given event name and event data (the
   * function result is provided as well).
   *
   * @method instrument
   * @param eventName {String}
   * @param data {Object}
   * @param workFn {Function}
   * @return {Promise}
   */
  instrument(eventName, data, workFn) {
    let startTime;
    return new Promise((resolve) => {
      startTime = process.hrtime();
      resolve(workFn());
    }).tap((result) => {
      let duration = process.hrtime(startTime);
      let milliseconds = (duration[0] * 1000) + (Math.round(duration[1] / 1000) / 1000);
      this._emitter.emit(eventName, data, result, milliseconds);
    });
  }

};
