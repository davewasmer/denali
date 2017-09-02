---
title: Quickstart
---

# Getting Started

It's everyone's favorite first project for a server side framework: let's build
a basic blogging application!

## Installation

First off, make sure you install Denali globally via npm:

```sh
$ npm install -g denali-cli denali
```

## Scaffolding our application

> Note: Denali requires you to use Node 7.0 or greater.

Next, let's use Denali's handy scaffolding tools to create a blank slate for us
to start from:

```sh
$ denali new blog
create blog/.babelrc
create blog/.editorconfig
create blog/.env
create blog/.eslintignore
create blog/.eslintrc
create blog/.gitattributes
create blog/.nvmrc
create blog/.travis.yml
create blog/CHANGELOG.md
create blog/README.md
create blog/app/actions/application.js
create blog/app/actions/index.js
create blog/app/application.js
create blog/app/index.js
create blog/app/models/application.js
create blog/app/serializers/application.js
create blog/app/services/.gitkeep
create blog/config/environment.js
create blog/config/initializers/.gitkeep
create blog/config/middleware.js
create blog/config/routes.js
create blog/denali-build.js
create blog/.gitignore
create blog/package.json
create blog/test/.eslintrc
create blog/test/acceptance/index-test.js
create blog/test/helpers/.gitkeep
create blog/test/unit/.gitkeep
✔ Dependencies installed
✔ Git repo initialized
📦  blog created!

To launch your application, just run:

  $ cd blog && denali server

```

Go ahead and follow that last instruction:

```sh
$ cd blog
$ denali server
✔ blog build complete (1.829s)
[2017-01-12T17:36:52.437Z] INFO - blog@0.0.1 server up on port 3000
```

Perfect! You've got your first Denali app up and running. Now let's see it in
action. Hit the root endpoint with curl:

```sh
$ curl localhost:3000
{
   "message": "Welcome to Denali!"
}
```

> **Heads up!** Notice that we didn't visit that localhost URL in the browser.
> That's because Denali is designed to build **APIs** rather than HTML rendering
> applications. If you are looking for Node framework to build a server rendered
> web application, you might want to try something like Sails.js or Express.

Great, we got an app up and running! Now that's cool, but it's not _that_ cool.
Let's crack open the scaffolded code to see how we got that welcome message, and
how to add our own code.


### Directory structure

The `denali new` command did a lot of setup for us. It created the following
directory structure:

```txt
blog/
  app/
    actions/
      application.js
      index.js
    models/
      application.js
    serializers/
      application.js
    services/
    application.js
    index.js
  config/
    initializers/
    environment.js
    middleware.js
    routes.js
  test/
    acceptance/
      index-test.js
    helpers/
    unit/
    .eslintrc
  .babelrc
  .editorconfig
  .env
  .eslintignore
  .eslintrc
  .gitattributes
  .gitignore
  .nvmrc
  .travis.yml
  CHANGELOG.md
  denali-build.js
  package.json
  README.md
```

There's a lot there, but for now, let's open up the `config/routes.js` to see
how that root endpoint is being handled:

```js
// config/routes.js
export default function drawRoutes(router) {

  router.get('/', 'index');

}
```

This should look somewhat familiar if you used frameworks like Rails before. The
`router.get('/', 'index')` method tells Denali to respond to `GET /` with the
`index` action.

In `app/actions/index.js`, we can see how that is handled:

```js
// app/actions/index.js
import ApplicationAction from './application';

export default class IndexAction extends ApplicationAction {

  respond() {
    this.render(200, { message: 'Welcome to Denali!' }, { serializer: 'raw' });
  }

}
```

Let's break down what's going on here:

  * `import ApplicationAction from './application';` - we import the
    `ApplicationAction` to use as our common base class. You could import the
    base `Action` class from the `denali` module directly, but having a base
    class for all actions in your app is handy (and common convention).

  * `respond()` - the `respond()` method is the meat of any action. It defines
    how the action responds to an incoming request.

  * `this.render(...)` - tells Denali to render the follow as the response. In
    this case, it says to render an HTTP 200 status code, with the `message`
    object as the payload, and use the `'raw'` serializer to format the response
    body (which in this case, simply `JSON.stringify()`s the payload).

The end result here is an action which will always respond with the same JSON
object that we saw above: `{ "message": "Welcome to Denali!" }`.

## Adding a resource

Now let's get a bit more creative. Our blog API is going to need to store and
retrieve our blog posts. Let's create a `post` resource to enable that.

> Normally, you'd probably store these in some kind of database (i.e. Mongo,
> Postgres, MySQL, etc). Denali is **database agnostic** though. So for now,
> we'll use plain ol' JS objects (a.k.a. POJOs). But you can easily substitute
> your own models in later. For more details, check out the [Data
> guides](../../data/models).

To start, let's use that handy scaffolding tool again:

```sh
$ denali generate resource post
```

This scaffold creates several files:

  * A set of **actions** in `app/actions/posts/` for this resource with the
    basic CRUD operations stubbed out. These files are where you'll implement
    your application logic to respond to a particular request. We saw these
    above.

  * A **serializer** to determine how your posts will be rendered in the
    response. We'll learn more about this in a bit.

  * A **model** to represent your posts.

  * A placeholder **acceptance test suite** for this resource. Denali comes with
    a first-class testing environment ready to go.

If we open up `app/actions/posts/list.js` now, you can see the stubbed out
actions:

```js
  // app/actions/posts/list.js
  export default class ListPosts extends ApplicationAction {

    async respond() {
      return this.db.all('post');
    }

  }
```

## Working with a database

You'll notice that the stubbed out actions reference `this.db`. This is a
service automatically injected into actions that handles querying your database
via ORM adapters. There's a few key methods to know, all of which return a
promise that resolves with the query results (except for `db.create`):

* `db.find(id)` - look up a single record by it's id
* `db.queryOne(query)` - lookup up a single record that matches the given query
* `db.query(query)` - find all records that match the given query
* `db.all()` - find all records of a given type
* `db.create(type, data)` - create a new Model instance of the given type (note:
   this method is synchronous, and does not immediately persist the newly
   created record)

##### A quick diversion about how Denali handles models and data

Denali takes a somewhat unique approach. Most frameworks ship with some kind of
Object Relational Mapper (ORM) baked right in. It transforms rows from a
database into objects you can manipulate.

Here's the thing: **ORMs are hard. _Really hard._** To make matters worse,
there's **no generally accepted "good" ORM for Node.js that covers all the
commonly used databases**.

With this in mind, Denali purposefully **does not ship with an ORM**. Instead,
Denali's Models are essentially a thin shim layer that lets you plug your own
ORM in instead, using ORM adapters.

There's lots of reasons why this is a powerful approach, but those are covered
in the Data guides. For now, let's forge ahead and setup our data store.

### The Memory Adapter

To help us get started, Denali ships with an in-memory ORM adapter, which can be
useful for testing and debugging use cases. It's the default ORM for newly
scaffolded projects, so it's already setup and will be used by default. We'll
use it now to get going without needing to setup an actual database.

> **Note:** The provided memory adapter should **not** be used for production
> applications - data will not be saved across server restarts, and the
> performance is likely quite poor. It's meant purely for testing and debugging
> use cases.

When you are ready to integrate with a real database, take a look at the various
[ORM adapters available for Denali](../../data/orm-adapters) for details on
installing and configuring each.

## Adding a model

The resource generator we ran above already added a blank Post model for us in
`app/models/post.js`. Let's open that up, and add a `title` attribute so we can
store the title of each blog post:

```js

import { attr /* , hasOne, hasMany */ } from 'denali';
import ApplicationModel from './application';

export default class Post extends ApplicationModel {

  static title = attr('text'); // <- add this

}
```

Okay, let's break this one down.

```js
import { attr /* , hasOne, hasMany */ } from 'denali';
import ApplicationModel from './application';
```

First up, we follow the same pattern of having a base "Application" class that
we did with Actions. We also import the `attr()` helper from Denali, which is
used to define an attribute on the model:

```js
  static title = attr('text');
```

Here, we create our `title` attribute. Note that attributes are declared as
static properties. Now, back in our actions, we can see that the resource
scaffold added code that will lookup all posts via `this.db.all('post')`:

```js
// app/actions/posts/list.js
  respond() {
    return this.db.all('post');
  }
```

Over in our create action, we can let the user create new blog posts too. Notice
how here we are taking the body of the incoming request and using that to
populate our new Post record.

```js
// app/actions/posts/create.js
  respond({ body }) {
    return this.db.create('post', body);
  }
```

Great! Now we can create and list all the Posts in our in-memory data store.
Let's test it out by first creating a post:

```sh
$ curl localhost:3000/posts -X POST -d '{"title": "My first post!"}'

{
  "id": 1
}
```

Looks like our Post was created! But if we look closely - our post's title (`"My
first post!") wasn't returned. And if we check the post listing endpoint (`GET
/posts`):

```sh
$ curl localhost:3000/posts

[
  {
    "id": 1
  }
]
```

It's missing there too! **What's going on here?**

## Working with Serializers

The reason our `title` field was missing was because we didn't tell Denali that
we wanted it returned. We do this with serializers.

In Denali, a serializer takes a payload object (or array), and transforms it
into the string of JSON to send back in the response.

By default, serializers are configured with a whitelist of allowed attributes.
Since we haven't touched our `post` serializer yet, the `title` attribute isn't
in that whitelist, so it gets stripped out of all our responses by default.

Let's fix that now by adding it to the whitelist:

```js
// app/serializers/post.js
import ApplicationSerializer from './application';

export default class PostSerializer extends ApplicationSerializer {

  attributes = [ 'title' ];

}
```

And now let's try to list the posts again:

```sh
$ curl localhost:3000/posts

[
  {
    "id": 1,
    "title": "My first post!"
  }
]
```

There it is! Our blog is off to a promising start.

## Next Steps

Congrats, you made it through the quickstart guide. From here, you can:

* Check out the rest of the guides to learn more about the different parts of
  the framework
* Dive into the API documentation to get into the gritty details
* Explore the [heavily commented source
  code](https://github.com/denali-js/denali)
