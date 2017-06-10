# Contributing

The guide outlines how to get started with the latest code on the `master` branch
and how to go about implementing or fixing a feature.

## Getting Started

After forking and cloning this repository, you need to do the following locally to setup
denali as a global process.

```sh
cd denali
npm install
npm run build
npm link dist
```

This makes denali available as `denali` and now you can use `denali new my-app`.
After generating a new app, you need to link back to the built version of denali.

```sh
cd my-app
npm link ../denali/dist
npm start
```

Now you should be running the latest code from master, and are ready to test and submit
your first pull request.
