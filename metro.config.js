const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const { createXtreamProxyMiddleware } = require("./server/xtreamProxy");

const config = getDefaultConfig(__dirname);
const nativeWindConfig = withNativeWind(config, { input: "./global.css" });
const enhanceMiddleware = nativeWindConfig.server.enhanceMiddleware;

nativeWindConfig.server.enhanceMiddleware = (middleware, metroServer) => {
  const enhanced = enhanceMiddleware
    ? enhanceMiddleware(middleware, metroServer)
    : middleware;
  return createXtreamProxyMiddleware(enhanced);
};

module.exports = nativeWindConfig;
