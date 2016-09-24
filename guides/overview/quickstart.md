---
title: Quickstart
---



# Getting Started

It's that ever-favorite first project for a server side framework: let's build a
basic blogging application!



## Installation

First off, make sure you install Denali globally via npm:

```sh
$ npm install -g denali
```



## Scaffolding our application

> Note: Denali requires you to use Node 6.0 or greater.

Next, let's use Denali's handy scaffolding tools to create a blank slate for us
to start from:

```sh
$ denali new blog
denali v0.1.0 [global]
  create app/actions/application.js
  create app/actions/index.js
  create app/models/.gitkeep
  create app/serializers/.gitkeep
  create app/services/.gitkeep
  create config/environment.js
  create config/middleware.js
  create config/routes.js
  create test/helpers/.gitkeep
  create test/integration/.gitkeep
  create test/unit/.gitkeep
  create test/index.js
  create .babelrc
  create .eslintrc
  create .gitattributes
  create .gitignore
  create CHANGELOG.md
  create package.json
  create README.md

Installing npm dependencies ...
Setting up git repo ...

Installation complete!
To launch your application, just run:

  $ cd blog && denali server

```

Go ahead and follow that last instruction:

```txt
$ cd blog
$ denali server
denali v0.0.1
2015-09-13T23:21:44.404Z [INFO] blog@0.0.1 server up on port 3000
```

Perfect! You've got your first Denali app up and running. Now let's see it in
action. Hit the root endpoint with curl:

```txt
$ curl localhost:3000
{"denaliVersion":"0.0.1","message":"Welcome to Denali!"}
```

> **Heads up!** Notice that we didn't visit that localhost URL in the browser.
> That's because Denali is designed to build **APIs** rather than HTML rendering
> applications. If you are looking for Node framework to build a server rendered
> web application, you might want to try something like Sails.js or Express.

Great, we got an app up and running! Now that's cool, but it's not _that_ cool
Let's crack open the scaffolded code to see how that root endpoint is working,
and how to add our own.


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
    serializers/
  config/
    initializers/
    environment.js
    middleware.js
    routes.js
  test/
    helpers/
    integration/
    unit/
  .eslintrc
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
`router.get()` method adds an endpoint that responds to GET requests at the url
provided in the first argument (`'/'` in this case).

The second argument identifies an action to route these requests to (in this
case, the `index` action).

In `app/actions/index.js`, we can see how that is handled:

```js
// app/actions/index.js
import ApplicationAction from './application';

export default class IndexAction extends ApplicationAction {

  respond() {
    return new Response(200, {
      message: 'Welcome to Denali!'
    }, { raw: true });
  }

}
```

Let's break down what's going on here:

  * `import ApplicationAction from './application';` - we import the
  `ApplicationAction` to use as our common base class. You could import the base
  `Action` class from the `denali` module directly, but having a base class for
  all actions in your app is handy (and common convention).
  * `respond()` - the `respond()` method is the meat of any action. It defines
  how the action responds to an incoming request.
  * `return new Response(...)` - you can tell Denali what to respond to a
  request with in a few different ways. Here, we return a `Response` object
  which has details of what kind of response we want to send. The `raw` option
  tells Denali not to send this payload through the serializer layer. More on
  that below!

The end result here is an action which will always respond with the same JSON
object that we saw above: `{ "message": "Welcome to Denali!" }`.

## Adding a resource

Now let's get a bit more creative. Our blog API is going to need to store and
retrieve our blog posts. Let's create a Post resource to enable that.

> Normally, you'd probably store these in some kind of database (i.e. Mongo,
> Postgres, MySQL, etc). Denali is **database agnostic** though. So for now,
> we'll use plain ol' JS objects (a.k.a. POJOs). But you can easily substitute
> your own models in later. For more details, check out the [Data guides](../../data/models).

To start, let's use that handy scaffolding tool again:

```sh
$ denali generate resource posts
```

This scaffold creates several files:

  * A set of **actions** for this resource with the basic CRUD operations
  stubbed out. These files are where you'll implement your application logic to
  respond to a particular request. We saw these above.

  * A **serializer** to determine how your Posts will be rendered in the
  response. We'll learn more about this in a bit.

  * A **model** to represent your Posts.

  * A placeholder **integration test suite** for this resource. Denali comes
  with a first-class testing environment, setup and ready to go.

If we open up `app/actions/posts/` now, you can see the stubbed out actions:

```js
  // app/actions/posts/list.js
  export default class ListPosts extends ApplicationAction {
    respond() {
      return new Errors.NotImplemented();
    }
  }
```

Let's go ahead and implement that list action now. We'll just hardcode the Posts
into the response for now:

```js
// app/controllers/posts.js

  respond() {
    return new Response([
      {
        id: 1,
        title: 'Denali is awesome'
      },
      {
        id: 2,
        title: 'You are awesome!'
      }
      ], { raw: true });
  }
```

Great! Let's hit that endpoint now:

```sh
$ curl localhost:3000/posts
[
  {
    "id": 1,
    "title": "Denali is awesome"
  },
  {
    "id": 2,
    "title": "You are awesome!"
  }
]
```

## Adding a database

Hardcoded JSON still isn't all that interesting. Let's integrate with a data
store so consumers of the API can actually manipulate the data.

Denali takes a unique approach to handling database integrations. Most
frameworks ship with some kind of Object Relational Mapper (ORM) baked right in.
It transforms rows from a database into objects you can manipulate.

Here's the thing: **ORMs are hard. _Really hard._** To make matters worse,
there's **no generally accepted "good" ORM for Node.js**.

With this in mind, Denali purposefully **does not ship with an ORM**. Instead,
Denali's Models are essentially a thin adapter layer that lets you plug your
own ORM in instead.

There's lots of reasons why this is a powerful approach, but those are covered
in the Data guides. For now, let's forge ahead and setup our data store.

### Memory Adapter

Denali ships with an in-memory data store and ORM adapter, which can be useful
for testing and debugging use cases. It's the default ORM for newly scaffolded
projects, so it's already setup and ready to go. We'll use it now to get going
without needing to setup an actual database.

## Adding a model

Let's add a Post model that will represent one of our blog posts:

```sh
$ denali generate model post
```

This creates `app/models/post.js`. Let's open that up, and add our title
attribute:

```js
import ApplicationModel from './application';

export default class Post extends ApplicationModel {

  static title = attr('text');

}
```

Okay, let's break this one down. First up, we follow the same pattern of having
a base "Application" class that we did with Actions:

```js
import ApplicationModel from './application';
```

Next, we create our `title` attribute (note the class properties syntax, and
that attributes are declared as static properties):

```js
  static title = attr('text');
```

Now, back in our actions, we can use the Post model to find and return all our
posts:

```js
// app/actions/posts/list.js
  respond() {
    let Post = this.modelFor('post');
    return Post.find();
  }
```

The `Post.find()` method, when invoked with no parameters, will return a Promise
that resolves with all the Post records.

Over in our create action, we can let the user create new blog posts too:

```js
// app/actions/posts/create.js
  respond(params) {
    let Post = this.modelFor('post');
    return Post.create(params);
  }
```

Great! Now we can create and list all the Posts in our in-memory data store.
Let's test it out:

```sh
$ curl localhost:3000/posts -X POST -d '{"title": "My first post!"}'

{
  "id": 1
}
```

Looks like our Post was created, but the `title` wasn't returned. If we check
this listing endpoint:

```sh
$ curl localhost:3000/posts

[
  {
    "id": 1
  }
]
```

It's missing there too. What's going on here?

## Working with Serializers

The reason our `title` field was missing was because of our Serializers.

A Serializer takes an in-memory payload object (or array), and transforms it into
JSON to send back in the response.

By default, Serializers are configured with a whitelist of which attributes are
allowed to be returned. Since we haven't touched our PostSerializer yet, the
`title` attribute isn't in that whitelist, so it gets stripped out of all our
responses.

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

* Check out the rest of the guides to learn more about the different parts of the framework
* Dive into the API documentation to get into the gritty details
* Explore the [heavily commented source code](https://github.com/denali-js/denali)
