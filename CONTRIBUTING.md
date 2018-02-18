# Contributing

The guide outlines how to get started with the latest code on the `master` branch
and how to go about implementing or fixing a feature.

## Getting Started

After forking and cloning this repository, you need to do the following locally to setup
denali as a global process.

```sh
cd ~/projects/denali
npm install
npm run build
npm link dist
```

This makes denali available as `denali` and now you can use `denali new my-app`.
After generating a new app, you need to link back to the built version of denali.

```sh
cd ~/projects/my-app
npm link ../denali/dist
npm start
```

Now you should be running the latest code from master, and are ready to test and submit
your first pull request.

## Adding local addons

Addons must be built, and linked into your app to work.

```sh
cd ~/projects/my-addon
npm run build
```

After building the addon, a `dist` folder should be generated, and
this should be linked into your app.

```sh
cd ~/projects/my-app
npm link ../my-addon/dist
```

Now when you start your app, the addon should be available.

## Debugging

Due to how Denali works, and the fact that it has it's own CLI that does the transpiling, you cannot
use `node debug ..` or `node --inspect ..`. Denali has a built in command which mimicks `node --inspect`.

```sh
denali server --debug
```

This will run the server and watch your code changes, and give you a URL to open so you can debug your app/addon
using Chrome DevTools. Once you visit the URL, the app will start running. From there you can set breakpoints and
call your API endpoints to trigger the breakpoints.

To mimic `node --inspect-brk` you can use:

```sh
denali server --debug-brk
```