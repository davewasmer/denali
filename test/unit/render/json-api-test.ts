/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import test from 'ava';
import { isArray } from 'lodash';
import { JSONAPISerializer, Model, attr, Container, MemoryAdapter, Router, Action, hasMany, Errors, hasOne } from 'denali';

test.beforeEach(async (t) => {
  let container = t.context.container = new Container(__dirname);
  container.register('action:posts/show', Action);
  container.register('action:comments/show', Action);
  container.register('app:router', class extends Router {});
  let router = container.lookup<Router>('app:router');
  router.map((router) => {
    router.get('/posts', 'posts/show');
  });
  container.register('orm-adapter:application', class extends MemoryAdapter {});
});

test('renders models as JSON-API resource objects', async (t) => {
  let container = <Container>t.context.container;
  container.register('serializer:post', class TestSerializer extends JSONAPISerializer {
    attributes = [ 'title' ];
    relationships = {};
  });
  container.register('model:post', class Post extends Model {
    static title = attr('string');
  });
  let Post = container.factoryFor('model:post');
  let serializer = container.lookup('serializer:post');

  let payload = await Post.create(container, { title: 'foo' }).save();
  let result = await serializer.serialize(<any>{}, payload, {});

  t.is(result.data.attributes.title, 'foo');
});

test('renders errors according to spec', async (t) => {
  let container = <Container>t.context.container;
  container.register('serializer:application', class TestSerializer extends JSONAPISerializer {
    attributes: string[] = [];
    relationships = {};
  });
  let serializer = container.lookup('serializer:application');

  let result = await serializer.serialize(<any>{}, new Errors.InternalServerError('foo'), {});

  t.is(result.errors[0].status, 500);
  t.is(result.errors[0].code, 'InternalServerError');
  t.is(result.errors[0].detail, 'foo');
});

test('renders validation errors with additional details', async (t) => {
  let container = <Container>t.context.container;
  container.register('serializer:application', class TestSerializer extends JSONAPISerializer {
    attributes: string[] = [];
    relationships = {};
  });
  let serializer = container.lookup('serializer:application');

  let error = <any>new Errors.UnprocessableEntity('Email cannot be blank');
  error.title = 'presence';
  error.source = '/data/attributes/email';
  let result = await serializer.serialize(<any>{}, error, {});

  t.is(result.errors[0].status, 422);
  t.is(result.errors[0].code, 'UnprocessableEntityError');
  t.is(result.errors[0].title, 'presence');
  t.is(result.errors[0].source, '/data/attributes/email');
  t.is(result.errors[0].detail, 'Email cannot be blank');
});

test('sideloads related records', async (t) => {
  let container = <Container>t.context.container;
  container.register('serializer:post', class PostSerializer extends JSONAPISerializer {
    attributes = [ 'title' ];
    relationships = {
      comments: {
        strategy: 'embed'
      }
    };
  });
  container.register('serializer:comment', class CommentSerializer extends JSONAPISerializer {
    attributes = [ 'text' ];
    relationships = {};
  });
  container.register('model:post', class Post extends Model {
    static title = attr('string');
    static comments = hasMany('comment');
  });
  container.register('model:comment', class Comment extends Model {
    static text = attr('string');
  });
  let Post = container.factoryFor('model:post');
  let Comment = container.factoryFor('model:comment');
  let serializer = container.lookup('serializer:post');

  let post = await Post.create(container, { title: 'foo' }).save();
  let comment = await Comment.create(container, { text: 'bar' }).save();
  await post.addComment(comment);
  let result = await serializer.serialize(<any>{}, post, {});

  t.true(isArray(result.included));
  t.is(result.included[0].attributes.text, 'bar');
});

test.todo('dedupes sideloaded related records');

test('embeds related records as resource linkage objects', async (t) => {
  let container = <Container>t.context.container;
  container.register('serializer:post', class PostSerializer extends JSONAPISerializer {
    attributes = [ 'title' ];
    relationships = {
      comments: {
        strategy: 'id'
      }
    };
  });
  container.register('serializer:comment', class CommentSerializer extends JSONAPISerializer {
    attributes = [ 'text' ];
    relationships = {};
  });
  container.register('model:post', class Post extends Model {
    static title = attr('string');
    static comments = hasMany('comment');
  });
  container.register('model:comment', class Comment extends Model {
    static text = attr('string');
  });
  let Post = container.factoryFor('model:post');
  let Comment = container.factoryFor('model:comment');
  let serializer = container.lookup('serializer:post');

  let post = await Post.create(container, { title: 'foo' }).save();
  let comment = await Comment.create(container, { text: 'bar' }).save();
  await post.addComment(comment);
  let result = await serializer.serialize(<any>{}, post, {});

  t.true(isArray(result.included));
  t.is(result.included[0].id, comment.id);
  t.is(result.included[0].type, 'comments');
});

test('renders document meta', async (t) => {
  let container = <Container>t.context.container;
  container.register('serializer:post', class TestSerializer extends JSONAPISerializer {
    attributes: string[] = [];
    relationships = {};
  });
  container.register('model:post', class Post extends Model {});
  let Post = container.factoryFor('model:post');
  let serializer = container.lookup('serializer:post');

  let payload = await Post.create(container, {}).save();
  let result = await serializer.serialize(<any>{}, payload, { meta: { foo: true }});

  t.true(result.meta.foo);
});

test('renders document links', async (t) => {
  let container = <Container>t.context.container;
  container.register('serializer:post', class TestSerializer extends JSONAPISerializer {
    attributes: string[] = [];
    relationships = {};
  });
  container.register('model:post', class Post extends Model {});
  let Post = container.factoryFor('model:post');
  let serializer = container.lookup('serializer:post');

  let payload = await Post.create(container, {}).save();
  let result = await serializer.serialize(<any>{}, payload, { links: { foo: true }});

  t.true(result.links.foo);
});

test('renders jsonapi version', async (t) => {
  let container = <Container>t.context.container;
  container.register('serializer:post', class TestSerializer extends JSONAPISerializer {
    attributes: string[] = [];
    relationships = {};
  });
  container.register('model:post', class Post extends Model {});
  let Post = container.factoryFor('model:post');
  let serializer = container.lookup('serializer:post');

  let payload = await Post.create(container, {}).save();
  let result = await serializer.serialize(<any>{}, payload, {});

  t.is(result.jsonapi.version, '1.0');
});

test('renders an array of models as an array under `data`', async (t) => {
  let container = <Container>t.context.container;
  container.register('serializer:post', class TestSerializer extends JSONAPISerializer {
    attributes = [ 'title' ];
    relationships = {};
  });
  container.register('model:post', class Post extends Model {
    static title = attr('string');
  });
  let Post = container.factoryFor('model:post');
  let serializer = container.lookup('serializer:post');

  let postOne = await Post.create(container, { title: 'foo' }).save();
  let postTwo = await Post.create(container, { title: 'bar' }).save();
  let result = await serializer.serialize(<any>{}, [ postOne, postTwo ], {});

  t.true(isArray(result.data));
  t.is(result.data[0].id, postOne.id);
  t.is(result.data[1].id, postTwo.id);
});

test('only renders whitelisted attributes', async (t) => {
  let container = <Container>t.context.container;
  container.register('serializer:post', class PostSerializer extends JSONAPISerializer {
    attributes = [ 'title' ];
    relationships = {};
  });
  container.register('model:post', class Post extends Model {
    static title = attr('string');
    static content = attr('string');
  });
  let Post = container.factoryFor('model:post');
  let serializer = container.lookup('serializer:post');

  let post = await Post.create(container, { title: 'foo', content: 'bar' }).save();
  let result = await serializer.serialize(<any>{}, post, {});

  t.is(result.data.attributes.title, 'foo');
  t.falsy(result.data.attributes.content);
});

test('only renders whitelisted relationships', async (t) => {
  let container = <Container>t.context.container;
  container.register('serializer:post', class PostSerializer extends JSONAPISerializer {
    attributes = [ 'title' ];
    relationships = {
      comments: {
        strategy: 'id'
      }
    };
  });
  container.register('serializer:comment', class CommentSerializer extends JSONAPISerializer {
    attributes = [ 'text' ];
    relationships = {};
  });
  container.register('model:post', class Post extends Model {
    static title = attr('string');
    static author = hasOne('user');
    static comments = hasMany('comment');
  });
  container.register('model:comment', class Comment extends Model {
    static text = attr('string');
  });
  container.register('model:user', class Comment extends Model {});
  let Post = container.factoryFor('model:post');
  let serializer = container.lookup('serializer:post');

  let post = await Post.create(container, { title: 'foo' }).save();
  let result = await serializer.serialize(<any>{}, post, {});

  t.true(isArray(result.data.relationships.comments.data));
  t.falsy(result.data.relationships.author);
});

test('uses related serializers to render related records', async (t) => {
  let container = <Container>t.context.container;
  container.register('serializer:post', class PostSerializer extends JSONAPISerializer {
    attributes = [ 'title' ];
    relationships = {
      comments: {
        strategy: 'embed'
      }
    };
  });
  container.register('serializer:comment', class CommentSerializer extends JSONAPISerializer {
    attributes = [ 'text' ];
    relationships = {};
  });
  container.register('model:post', class Post extends Model {
    static title = attr('string');
    static comments = hasMany('comment');
  });
  container.register('model:comment', class Comment extends Model {
    static text = attr('string');
    static publishedAt = attr('string');
  });
  let Post = container.factoryFor('model:post');
  let Comment = container.factoryFor('model:comment');
  let serializer = container.lookup('serializer:post');

  let post = await Post.create(container, { title: 'foo' }).save();
  await post.addComment(await Comment.create(container, { text: 'bar', publishedAt: 'fizz' }).save());
  let result = await serializer.serialize(<any>{}, post, {});

  t.true(isArray(result.included));
  t.is(result.included[0].attributes.text, 'bar');
  t.falsy(result.included[0].attributes.publishedAt);
});

test.todo('renders resource object meta');

test.todo('renders resource object links');

test('dasherizes field names', async (t) => {
  let container = <Container>t.context.container;
  container.register('serializer:post', class TestSerializer extends JSONAPISerializer {
    attributes = [ 'publishedAt' ];
    relationships = {};
  });
  container.register('model:post', class Post extends Model {
    static publishedAt = attr('string');
  });
  let Post = container.factoryFor('model:post');
  let serializer = container.lookup('serializer:post');

  let payload = await Post.create(container, { publishedAt: 'foo' }).save();
  let result = await serializer.serialize(<any>{}, payload, {});

  t.is(result.data.attributes['published-at'], 'foo');
});

test.todo('renders relationship meta');

test.todo('renders relationship links');
