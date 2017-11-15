# set -e
echo "Preparing clean slate test run ..."
rm -rf tmp dist coverage .nyc_output
echo "Bootstrapping Denali commands"
npm run bootstrap
echo "Linking Denali globally"
yarn link 2> /dev/null
echo "Full build"
denali build
echo "Running tests"
NODE_ENV=test nyc denali test --verbose "$@"
