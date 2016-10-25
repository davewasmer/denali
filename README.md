# Denali

[![NPM version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]
[![Coverage][coverage-image]][coverage-url]
[![Dependency Status][depstat-image]][depstat-url]
[![Downloads][download-image]][npm-url]
[![Standard Version][sv-image]][sv-url]

> An opinionated Node framework for building robust JSON APIs

Denali is a tool to help you build and deliver amibitous JSON APIs. It features:

 * First class JSON serializers, included out of the box JSON-API support
 * A single controller class (called Actions) per endpoint
 * Flexible, declarative filter system
 * An emphasis on developer happiness - a robust CLI, poweful testing primitives,
   and support for the full lifecycle of app development
 * ORM-agnostic design - choose your favorite Node ORM, or none at all

## Why Denali?

Denali should feel familiar to anyone whose worked with popular MVC frameworks
like Rails. But Denali has a slightly unique take on each aspect of the MVC
pattern:

### (M)VC - ORM Adapters instead of ORM lock-in

Unlike many server frameworks, Denali lets you choose which ORM you'd like to
use. ORMs are hard, and the Node ecosystem has multiple competing options, each
with it's own strengths and weaknesses. Rather than limiting you to a single
"official" ORM, or worse, attempting to roll our own, Denali uses an adapter
system to ensure that whatever ORM you bring, it can work with the Denali
ecosystem.

### M(V)C - Serializers instead of Views & Templates

Denali's view layer is unique as well. Rather than traditional HTML rendering,
Denali's view layer renders JSON. Instead of the usual templates and view
classes.  we have Serializers instead, which tell Denali how to render the data
you supply as a response. The separation of responsibilties ensures you can
tweak how your data is structured in your API without having to change any of
the logic of your app. Several common formats, include JSON-API, are supported
out of the box, and customization is easy.

### MV(C) - Actions instead of Controllers

In Denali, the Action class takes the role of the controller in the application.
But rather than a single controller class that responds to many different
endpoints, an Action class is responsible for responding to requests against
a single endpoint (URL + method) only. The result is powerful - since the
an Action class directly and completely represents the app's response handler,
we can use expressive declarative syntax to succicently define behaviors.

## Getting Started

You can install Denali globally via npm:

```sh
$ npm install -g denali
```

Create a new application (run with Node 6.0+):

```sh
$ denali new my-api
$ cd my-api
```

You can use the `server` command to run your API locally in development mode.
The API server will automatically restart when you change make a change:

```sh
$ denali server
```

To learn more, check out [the docs](http://denali.js.org/).

## License

MIT © [Dave Wasmer](http://davewasmer.com)


[npm-url]: https://npmjs.org/package/denali
[npm-image]: https://img.shields.io/npm/v/denali.svg?style=flat-square

[travis-url]: https://travis-ci.org/denali-js/denali
[travis-image]: https://img.shields.io/travis/denali-js/denali/master.svg?style=flat-square

[coverage-url]: https://codeclimate.com/github/denali-js/denali
[coverage-image]: https://img.shields.io/codeclimate/coverage/github/denali-js/denali.svg?style=flat-square

[depstat-url]: https://david-dm.org/denali-js/denali
[depstat-image]: https://david-dm.org/denali-js/denali/status.svg?style=flat-square

[download-image]: https://img.shields.io/npm/dm/denali.svg?style=flat-square

[sv-url]: https://github.com/conventional-changelog/standard-version
[sv-image]: https://img.shields.io/badge/release-standard%20version-brightgreen.svg?style=flat-square

