/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import { isArray } from 'lodash';
import test, { TestContext, Context } from 'ava';
import { Model, attr, hasMany, hasOne, Container, MemoryAdapter } from 'denali';

// Ensure a given finder method invokes it's corresponding adapter method
async function finderInvokesAdapter(t: TestContext & Context<any>, finder: string, adapterReturn: any, ...args: any[]) {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {});
  container.register('orm-adapter:post', {
    buildRecord() { return {}; },
    [finder]() {
      t.pass();
      return adapterReturn;
    }
  }, { instantiate: false, singleton: true });
  let klass = <typeof Model>container.factoryFor<Model>('model:post').class;
  await (<any>klass)[finder](...args);
}
(<any>finderInvokesAdapter).title = (providedTitle: string, finder: string) => `${ finder } invokes the ${ finder } method on the adapter`;

// Check the results of a finder method call, and stub out the corresponding adapter method
async function finderReturns(t: TestContext & Context<any>, options: {
  finder: string,
  arg: any,
  adapterMethod(): any,
  assert(t: TestContext, result: any): void
}) {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {});
  container.register('orm-adapter:post', {
    buildRecord() { return {}; },
    [options.finder]: options.adapterMethod
  }, { instantiate: false, singleton: true });
  let klass = <typeof Model>container.factoryFor<Model>('model:post').class;
  let result = await (<any>klass)[options.finder](options.arg);
  options.assert(t, result);
}


test.beforeEach((t) => {
  t.context.container = new Container(__dirname);
});

test('type returns the dasherized class name of the model', async (t) => {
  class BlogPost extends Model {}
  t.is(BlogPost.type, 'blog-post');
});

test('type omits trailing "Model" from class name if present', async (t) => {
  class BlogPostModel extends Model {}
  t.is(BlogPostModel.type, 'blog-post');
});

test('eachRelationship iterates over each relationship', async (t) => {
  class Post extends Model {
    static author = hasOne('user');
    static comments = hasMany('comment');
  }
  t.context.container.register('model:post', Post);

  let relationships = Post.eachRelationship((name, descriptor) => {
    return { name, mode: descriptor.mode };
  });

  t.deepEqual(relationships, [
    { name: 'author', mode: 'hasOne' },
    { name: 'comments', mode: 'hasMany' }
  ]);
});

test('adapter uses model-specific one if found', async (t) => {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {});
  container.register('orm-adapter:application', {}, { instantiate: false, singleton: true });
  let PostAdapter = {};
  container.register('orm-adapter:post', PostAdapter, { instantiate: false, singleton: true });

  let klass = <typeof Model>container.factoryFor<Model>('model:post').class;
  t.is(klass.adapter, PostAdapter);
});

test('adapter falls back to application if model specific not found', async (t) => {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {});
  let ApplicationAdapter = {};
  container.register('orm-adapter:application', ApplicationAdapter, { instantiate: false, singleton: true });

  let klass = <typeof Model>container.factoryFor<Model>('model:post').class;
  t.is(klass.adapter, ApplicationAdapter);
});

test(finderInvokesAdapter, 'find', {}, 1);

test(finderInvokesAdapter, 'findOne', {}, { foo: true });

test(finderInvokesAdapter, 'all', []);

test(finderInvokesAdapter, 'query', [], { foo: true });

test('find returns model instance', finderReturns, {
  finder: 'find',
  arg: 1,
  adapterMethod() { return {}; },
  assert(t: TestContext, result: any) {
    t.true(result instanceof Model);
  }
});

test('find returns null if adapter does', finderReturns, {
  finder: 'find',
  arg: 1,
  adapterMethod(): null { return null; },
  assert(t: TestContext, result: any) {
    t.is(result, null);
  }
});

test('findOne returns model instance', finderReturns, {
  finder: 'findOne',
  arg: { foo: true },
  adapterMethod() { return {}; },
  assert(t: TestContext, result: any) {
    t.true(result instanceof Model);
  }
});

test('findOne returns null if adapter does', finderReturns, {
  finder: 'findOne',
  arg: { foo: true },
  adapterMethod(): null { return null; },
  assert(t: TestContext, result: any) {
    t.is(result, null);
  }
});

test('all returns an array', finderReturns, {
  finder: 'all',
  arg: undefined,
  adapterMethod(): any[] { return []; },
  assert(t: TestContext, result: any) {
    t.true(isArray(result));
  }
});

test('query returns an array', finderReturns, {
  finder: 'query',
  arg: { foo: true },
  adapterMethod(): any[] { return []; },
  assert(t: TestContext, result: any) {
    t.true(isArray(result));
  }
});

test('get<RelationshipName> invokes adapter', async (t) => {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {
    static comments = hasMany('comment');
  });
  container.register('model:comment', class Comment extends Model {});
  container.register('orm-adapter:application', class extends MemoryAdapter {
    getRelated(model: Model, relationship: string, descriptor: any, query: any) {
      t.pass();
      return super.getRelated(model, relationship, descriptor, query);
    }
  });
  let Post = container.factoryFor<Model>('model:post');
  let post = await (<any>Post).create();
  await post.getComments();
});

test('get<RelationshipName> throws for non-existent relationships', async (t) => {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {});
  container.register('orm-adapter:application', class extends MemoryAdapter {});
  let Post = container.factoryFor<Model>('model:post');
  let post = await (<any>Post).create();
  t.throws(function() {
    post.getComments();
  });
});

test('get<RelationshipName> returns related model instances', async (t) => {
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {
    static comments = hasMany('comment');
  });
  container.register('model:comment', class Comment extends Model {});
  container.register('orm-adapter:application', class extends MemoryAdapter {});
  let Post = container.factoryFor<Model>('model:post');
  let Comment = container.factoryFor<Model>('model:comment');
  let post = await (<any>Post).create().save();
  await post.setComments([ await Comment.create().save() ]);
  let comments = await post.getComments();
  t.true(isArray(comments), 'comments is an array');
  t.is(comments.length, 1, 'has the correct number of comments');
});

test('getRelated allows queries for has many relationships', async (t) => {
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {
    static comments = hasMany('comment');
  });
  container.register('model:comment', class Comment extends Model {
    static foo = attr('boolean');
  });
  container.register('orm-adapter:application', class extends MemoryAdapter {});
  let Post = container.factoryFor<Model>('model:post');
  let Comment = container.factoryFor<Model>('model:comment');
  let post = await (<any>Post).create().save();
  let commentOne = await Comment.create({ foo: true }).save();
  let commentTwo = await Comment.create({ foo: false }).save();
  await post.setComments([ commentOne, commentTwo ]);
  let comments = await post.getComments({ foo: true });
  t.true(isArray(comments), 'comments is an array');
  t.is(comments.length, 1, 'has the correct number of comments');
});

test('set<RelationshipName> invokes adapter', async (t) => {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {
    static comments = hasMany('comment');
  });
  container.register('model:comment', class Comment extends Model {});
  container.register('orm-adapter:application', class extends MemoryAdapter {
    setRelated(model: Model, relationship: string, descriptor: any, relatedModels: Model|Model[]) {
      t.pass();
      return super.setRelated(model, relationship, descriptor, relatedModels);
    }
  });
  let Post = container.factoryFor<Model>('model:post');
  let post = await (<any>Post).create();
  await post.setComments([]);
});

test('set<RelationshipName> throws for non-existent relationships', async (t) => {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {});
  container.register('orm-adapter:application', class extends MemoryAdapter {});
  let Post = container.factoryFor<Model>('model:post');
  let post = await (<any>Post).create();
  t.throws(function() {
    post.setComments();
  });
});

test('add<RelationshipName> invokes adapter', async (t) => {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {
    static comments = hasMany('comment');
  });
  container.register('model:comment', class Comment extends Model {});
  container.register('orm-adapter:application', class extends MemoryAdapter {
    addRelated(model: Model, relationship: string, descriptor: any, relatedModel: Model) {
      t.pass();
      return super.setRelated(model, relationship, descriptor, relatedModel);
    }
  });
  let Post = container.factoryFor<Model>('model:post');
  let Comment = container.factoryFor<Model>('model:comment');
  let post = await (<any>Post).create();
  let comment = await (<any>Comment).create();
  await post.addComment(comment);
});

test('add<RelationshipName> throws for non-existent relationships', async (t) => {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {});
  container.register('orm-adapter:application', class extends MemoryAdapter {});
  let Post = container.factoryFor<Model>('model:post');
  let post = await (<any>Post).create();
  t.throws(function() {
    post.addComment();
  });
});

test('remove<RelationshipName> invokes adapter', async (t) => {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {
    static comments = hasMany('comment');
  });
  container.register('model:comment', class Comment extends Model {});
  container.register('orm-adapter:application', class extends MemoryAdapter {
    removeRelated(model: Model, relationship: string, descriptor: any, relatedModel: Model) {
      t.pass();
      return super.removeRelated(model, relationship, descriptor, relatedModel);
    }
  });
  let Post = container.factoryFor<Model>('model:post');
  let Comment = container.factoryFor<Model>('model:comment');
  let post = await (<any>Post).create();
  let comment = await (<any>Comment).create();
  await post.addComment(comment);
  await post.removeComment(comment);
});

test('remove<RelationshipName> throws for non-existent relationships', async (t) => {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {});
  container.register('orm-adapter:application', class extends MemoryAdapter {});
  let Post = container.factoryFor<Model>('model:post');
  let post = await (<any>Post).create();
  t.throws(function() {
    post.removeComment();
  });
});

test('eachAttribute iterates over each attribute', (t) => {
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

test('#eachAttribute iterating over parent classes should not impact child classes', (t) => {
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
