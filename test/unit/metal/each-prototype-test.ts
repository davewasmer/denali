/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import test from 'ava';
import { eachPrototype } from 'denali';

test('walks prototype chain of object', async (t) => {
  class Grandparent {}
  class Parent extends Grandparent {}
  class Child extends Parent {}

  let prototypes: any[] = [];
  eachPrototype(Child, (prototype) => {
    prototypes.push(prototype);
  });

  t.deepEqual(prototypes, [ Child, Parent, Grandparent, Object.getPrototypeOf(Function), Object.getPrototypeOf({}) ]);
});
