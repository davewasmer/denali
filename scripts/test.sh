rm -rf node_modules/denali
rsync -av --progress . node_modules/denali --exclude node_modules --exclude .git
NODE_ENV=test nyc ./bin/denali test "$@"
