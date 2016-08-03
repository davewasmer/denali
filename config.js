module.exports = {
  data: {
    repo: 'denali-js/denali',
    baseurl: '/',
    title: 'Denali',
    url: 'http://localhost:4400'
  },
  versions: {
    branches: [
      'master'
    ],
    skip: [
      'v0.0.4',
      'v0.0.5'
    ],
    rename: {
      master: 'canary'
    },
    alias: {
      latest(versions) {
        return versions[0];
      }
    }
  }
};
