/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import test from 'ava';
import { isArray } from 'lodash';
import { FlatSerializer, Model, attr, Container, MemoryAdapter, hasMany, Errors, hasOne } from 'denali';

test.beforeEach((t) => {
  t.context.container = new Container(__dirname);
  t.context.container.register('orm-adapter:application', MemoryAdapter);
});

test('renders models as flat json structures', async (t) => {
  let container = <Container>t.context.container;
  container.register('serializer:application', class TestSerializer extends FlatSerializer {
    attributes = [ 'title' ];
    relationships = {};
  });
  container.register('model:post', class Post extends Model {
    static title = attr('string');
  });
  let serializer = container.lookup('serializer:application');
  let Post = container.factoryFor('model:post');
  let post = await Post.create({ title: 'foo' }).save();
  let result = await serializer.serialize(<any>{}, post, {});

  t.is(result.title, 'foo');
});

test('renders related records as embedded objects', async (t) => {
  let container = <Container>t.context.container;
  container.register('serializer:post', class PostSerializer extends FlatSerializer {
    attributes = [ 'title' ];
    relationships = {
      comments: {
        strategy: 'embed'
      }
    };
  });
  container.register('serializer:comment', class CommentSerializer extends FlatSerializer {
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

  let post = await Post.create({ title: 'foo' }).save();
  await post.addComment(await Comment.create({ text: 'bar' }).save());
  let result = await serializer.serialize(<any>{}, post, {});

  t.true(isArray(result.comments));
  t.is(result.comments[0].text, 'bar');
});

test('renders related records as embedded ids', async (t) => {
  let container = <Container>t.context.container;
  container.register('serializer:post', class PostSerializer extends FlatSerializer {
    attributes = [ 'title' ];
    relationships = {
      comments: {
        strategy: 'id'
      }
    };
  });
  container.register('serializer:comment', class CommentSerializer extends FlatSerializer {
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

  let post = await Post.create({ title: 'foo' }).save();
  let comment = await Comment.create({ text: 'bar' }).save();
  await post.addComment(comment);
  let result = await serializer.serialize(<any>{}, post, {});

  t.true(isArray(result.comments));
  t.is(result.comments[0], comment.id);
});

test('renders errors', async (t) => {
  let container = <Container>t.context.container;
  container.register('serializer:application', class PostSerializer extends FlatSerializer {
    attributes: string[] = [];
    relationships = {};
  });
  let serializer = container.lookup('serializer:application');

  let result = await serializer.serialize(<any>{}, new Errors.InternalServerError('foo'), {});
  t.is(result.status, 500);
  t.is(result.code, 'InternalServerError');
  t.is(result.message, 'foo');
});

test('only renders whitelisted attributes', async (t) => {
  let container = <Container>t.context.container;
  container.register('serializer:post', class PostSerializer extends FlatSerializer {
    attributes = [ 'title' ];
    relationships = {};
  });
  container.register('model:post', class Post extends Model {
    static title = attr('string');
    static content = attr('string');
  });
  let Post = container.factoryFor('model:post');
  let serializer = container.lookup('serializer:post');

  let post = await Post.create({ title: 'foo', content: 'bar' }).save();
  let result = await serializer.serialize(<any>{}, post, {});

  t.is(result.title, 'foo');
  t.falsy(result.content);
});

test('only renders whitelisted relationships', async (t) => {
  let container = <Container>t.context.container;
  container.register('serializer:post', class PostSerializer extends FlatSerializer {
    attributes = [ 'title' ];
    relationships = {
      comments: {
        strategy: 'id'
      }
    };
  });
  container.register('serializer:comment', class CommentSerializer extends FlatSerializer {
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

  let post = await Post.create({ title: 'foo' }).save();
  let result = await serializer.serialize(<any>{}, post, {});

  t.true(isArray(result.comments));
  t.falsy(result.author);
});

test('uses related serializers to render related records', async (t) => {
  let container = <Container>t.context.container;
  container.register('serializer:post', class PostSerializer extends FlatSerializer {
    attributes = [ 'title' ];
    relationships = {
      comments: {
        strategy: 'embed'
      }
    };
  });
  container.register('serializer:comment', class CommentSerializer extends FlatSerializer {
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

  let post = await Post.create({ title: 'foo' }).save();
  await post.addComment(await Comment.create({ text: 'bar', publishedAt: 'fizz' }).save());
  let result = await serializer.serialize(<any>{}, post, {});

  t.true(isArray(result.comments));
  t.is(result.comments[0].text, 'bar');
  t.falsy(result.comments[0].publishedAt);
});
