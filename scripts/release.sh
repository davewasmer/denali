set -e
npm test
standard-version
npm publish
git push
