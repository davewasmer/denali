---
title: Quickstart
---

# Getting Started

It's everyone's favorite first project for a server side framework: let's build
a basic blogging application!

## Installation

First off, let's install the Denali CLI.

```sh
# Installing with npm
$ npm install -g @denali-js/cli
# or, install with yarn
$ yarn global add @denali-js/cli
```

## Scaffolding our application

> Note: Denali requires you to use Node 7.0 or greater.

Next, let's use Denali's handy scaffolding tools to create a blank slate for us
to start from:

```sh
$ denali new my-blog
cli v0.0.25 [global]

create my-blog/.babelrc
create my-blog/.editorconfig
create my-blog/.env
create my-blog/.eslintignore
create my-blog/.eslintrc
create my-blog/.gitattributes
create my-blog/.nvmrc
create my-blog/.travis.yml
create my-blog/CHANGELOG.md
create my-blog/README.md
create my-blog/app/actions/application.js
create my-blog/app/actions/index.js
create my-blog/app/application.js
create my-blog/app/models/application.js
create my-blog/app/parsers/application.js
create my-blog/app/serializers/application.js
create my-blog/config/environment.js
create my-blog/config/initializers/.gitkeep
create my-blog/config/middleware.js
create my-blog/config/routes.js
create my-blog/denali-build.js
create my-blog/.gitignore
create my-blog/index.js
create my-blog/package.json
create my-blog/test/acceptance/index-test.js
create my-blog/test/unit/.gitkeep
✔ Dependencies installed
✔ Git repo initialized
📦  my-blog created!

To launch your application, just run:

  $ cd my-blog && denali server

```

Go ahead and follow that last instruction:

```sh
$ cd my-blog
$ denali server
cli v0.1.0 [local] | core v0.1.0 [local]
✔ my-blog build complete (1.829s)
[2017-01-12T17:36:52.437Z] INFO - my-blog@0.0.1 server up on port 3000
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
> That's because Denali is designed to build **APIs** rather than HTML
> rendering applications. If you are looking for Node framework to build a
> server rendered web application, you might want to try something like
> Sails.js or Express.

Great, we got an app up and running! Now that's cool, but it's not _that_ cool.
Let's crack open the scaffolded code to see how we got that welcome message, and
how to add our own code.


### Directory structure

The `denali new` command did a lot of setup for us. It created the following
directory structure:

```txt
my-blog/
  app/
    actions/
      application.js
      index.js
    models/
      application.js
    parsers/
      application.js
    serializers/
      application.js
    application.js
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
  index.js
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

This should look somewhat familiar if you used other web frameworks before.
The `router.get('/', 'index')` method tells Denali to respond to `GET /` with
the `index` action.

In `app/actions/index.js`, we can see how that is handled:

```js
// app/actions/index.js
import ApplicationAction from './application';

export default class IndexAction extends ApplicationAction {

  respond() {
    this.render(200, { message: 'Welcome to Denali!' }, { serializer: 'json' });
  }

}
```

Let's break down what's going on here:

  * `import ApplicationAction from './application';` - we import the
    `ApplicationAction` to use as our common base class. You could import the
    base `Action` class from the `@denali-js/core` module directly, but having
    a base class for all actions in your app is handy (and common convention).

  * `respond()` - the `respond()` method is the meat of any action. It defines
    how the action responds to an incoming request.

  * `this.render(...)` - tells Denali to render the follow as the response. In
    this case, it says to render an HTTP 200 status code, with the `message`
    object as the response body payload.

The end result here is an action which will always respond with the same JSON
object that we saw above: `{ "message": "Welcome to Denali!" }`.

## Adding a resource

Now let's get a bit more creative. Our blog API is going to need to store and
retrieve our blog posts. Let's create a `post` resource to enable that.

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

  * A **model** to represent your post data structure.

  * A placeholder **acceptance test suite** for this resource. Denali comes with
    a first-class testing environment ready to go.

If we open up `app/actions/posts/list.js` now, you can see the stubbed out
actions:

```js
  // app/actions/posts/list.js
  import Post from '../../models/post';

  export default class ListPosts extends ApplicationAction {

    async respond() {
      return Post.all();
    }

  }
```

Great! So we've got basic CRUD operations ready for our `Post` model. But -
where is all this data going to be stored?

## Working with a database

Denali takes a somewhat unique approach to handling databases. Most
frameworks ship with some kind of Object Relational Mapper (ORM) baked right
in, which handles talking to the database for you.

For a variety of reasons, Denali doesn't ship with it's own ORM. Instead, you
supply your own, and you can teach Denali how to use it by installing an ORM
adapter addon. There's a variety of these for popular Node ORMs, and it's
easy to make your own as well.

For now, to make things easier, we'll use the built-in MemoryAdapter.

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

## Working with models

The resource generator we ran above already added a blank Post model for us in
`app/models/post.js`. Let's open that up, and add a `title` attribute so we can
store the title of each blog post:

```js

import { attr } from '@denali-js/core';
import ApplicationModel from './application';

export default class Post extends ApplicationModel {

  static schema = {
    title: attr('string') // <- add this
  };

}
```

Okay, let's break this one down.

```js
import { attr } from '@denali-js/core';
import ApplicationModel from './application';
```

First up, we follow the same pattern of having a base "Application" class that
we did with Actions. We also import the `attr()` helper from Denali, which is
used to define an attribute on the model:

```js
  static schema = {
    title: attr('string') // <- add this
  };
```

The static `schema` property defines what attributes and relationships exist
on a Denali model. Here, we add a single attribute, `title`, and tell Denali
to expect a string value for it.

Over in our `actions/posts/create.js` action, we can let the user create new
blog posts too. Notice how here we are taking the body of the incoming
request and using that to populate our new Post record.

```js
  // app/actions/posts/create.js
  respond({ body }) {
    return Post.create({ body });
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
