# Use npm run test -- (other args here) to pass args to mocha
cd dist
NODE_ENV=test nyc mocha --recursive "$@"
