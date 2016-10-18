module.exports = function baseConfig(environment, appConfig) {
  if (!appConfig.logging) {
    appConfig.logging = {};
  }
  if (!appConfig.logging.hasOwnProperty('showDebuggingInfo')) {
    appConfig.logging.showDebuggingInfo = environment !== 'production';
  }
};
