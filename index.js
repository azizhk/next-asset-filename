const ClientBuildManifestPlugin = require("./client-build-manifest-plugin");

module.exports = ({ buildId = "assets", appendHash = false } = {}) => (
  nextConfig = {}
) => {
  return Object.assign({}, nextConfig, {
    ...(buildId && {
      generateBuildId: () => buildId
    }),

    webpack(config, options) {
      const { dev, isServer } = options;

      if (appendHash && isServer) {
        config.node = {
          ...config.node,
          __dirname: false
        };
      }

      if (!dev && !isServer) {
        const outputFilename = config.output.filename;
        config.output.filename = file => {
          const { chunk } = file;
          if (/\.js$/.test(chunk.name)) {
            if (appendHash) {
              return chunk.name.replace(/\.js$/, "-[contenthash].js");
            } else {
              return "[name]";
            }
          }
          return outputFilename(file);
        };

        if (!appendHash) {
          const chunkFilename = config.output.chunkFilename;
          config.output.chunkFilename = chunkFilename.replace(
            ".[contenthash]",
            ""
          );
        } else {
          config.plugins.push(new ClientBuildManifestPlugin());
        }
      }

      if (typeof nextConfig.webpack === "function") {
        return nextConfig.webpack(config, options);
      }
      return config;
    }
  });
};
