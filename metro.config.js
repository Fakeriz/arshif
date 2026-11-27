const { getDefaultConfig } = require('expo/metro-config');
const assetChartHandler = require('./api/asset-chart');

const config = getDefaultConfig(__dirname);
const prevEnhance = config.server?.enhanceMiddleware;

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, metroServer) => {
    const base = prevEnhance ? prevEnhance(middleware, metroServer) : middleware;
    return (req, res, next) => {
      if (req.url && (req.url === '/api/asset-chart' || req.url.startsWith('/api/asset-chart?'))) {
        void assetChartHandler(req, res);
        return;
      }
      return base(req, res, next);
    };
  },
};

module.exports = config;
