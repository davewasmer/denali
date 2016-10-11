import sourcemaps from 'source-map-support';
import path from 'path';
import Application from './application';

sourcemaps.install();

let application = new Application({
  environment: process.env.DENALI_ENV || process.env.NODE_ENV || 'development',
  dir: path.dirname(__dirname)
});

application.start();

export default application;
