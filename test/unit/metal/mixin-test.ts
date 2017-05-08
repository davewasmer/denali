/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import test from 'ava';
import { mixin, createMixin } from 'denali';

test('mixins apply in order', async (t) => {
  class Base {}
  let MixinOne = createMixin((BaseClass: new() => any) =>
    class MixinOne extends BaseClass {
      static foo = 'one';
    }
  );
  let MixinTwo = createMixin((BaseClass: new() => any) =>
    class MixinOne extends BaseClass {
      static foo = 'two';
    }
  );

  let Result = mixin(Base, MixinOne, MixinTwo);
  t.is(Result.foo, 'two');
});

test('mixins accumulate options until applied', async (t) => {
  t.plan(2);
  class Base {}
  let Mixin = createMixin((BaseClass: new() => any, optionsOne, optionsTwo) => {
    t.is(optionsOne, 'one');
    t.is(optionsTwo, 'two');
    return class MixinOne extends BaseClass {};
  });

  Mixin('one');
  Mixin('two');
  mixin(Base, Mixin);
});
