---
layout: homepage
---

## What is Denali?

Denali is a framework that makes building robust JSON APIs simple. It borrows the best concepts from frameworks like Rails, is built on the rock solid foundation of Express.js, and is designed for developer happiness.

## Getting started

There's a couple ways to get started using Denali:

1. Dive right in and [learn how to build the ever-popular blog application](quickstart.md).
2. Read more about [what makes Denali unique](why-denali.md).


```txt
$ npm install -g denali
$ denali new todo

$ cd todo && denali server
[INFO] todo@0.0.1 server up on port 3000

$ curl localhost:3000
{
  denaliVersion: "{{project.version}}",
  message: "Welcome to Denali!"
}
```
