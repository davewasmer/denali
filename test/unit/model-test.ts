/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import test from 'ava';
import { Model, attr, Container } from 'denali';

test.beforeEach((t) => {
  t.context.container = new Container(__dirname);
});

test('Model > #eachAttribute > iterates over each attribute', (t) => {
  class TestModel extends Model {
    static container = t.context.container;
    static foo = attr('text');
    static bar = attr('text');
  }
  let names: string[] = [];
  TestModel.eachAttribute((name) => {
    names.push(name);
  });
  t.deepEqual(names, [ 'foo', 'bar' ]);
});

test('Model > #eachAttribute > iterating over parent classes should not impact child classes', (t) => {
  class Parent extends Model {
    static container = t.context.container;
  }
  class Child extends Parent {
    static container = t.context.container;
    static foo = attr('text');
    static bar = attr('text');
  }
  let names: string[] = [];
  Parent.eachAttribute((name) => {
    names.push(name);
  });
  t.deepEqual(names, []);
  Child.eachAttribute((name) => {
    names.push(name);
  });
  t.deepEqual(names, [ 'foo', 'bar' ]);
});
