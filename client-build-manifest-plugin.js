const { RawSource } = require("webpack-sources");
const {
  ROUTE_NAME_REGEX,
  IS_BUNDLED_PAGE_REGEX,
  CLIENT_STATIC_FILES_RUNTIME_MAIN
} = require("next-server/constants");

const CLIENT_BUILD_MANIFEST = "client-build-manifest.json";

// This plugin creates a build-manifest.json for all assets that are being output
// It has a mapping of "entry" filename to real filename. Because the real filename can be hashed in production
module.exports = class ClientBuildManifestPlugin {
  apply(compiler) {
    compiler.hooks.emit.tapAsync(
      "NextJsBuildManifest",
      (compilation, callback) => {
        const { chunks } = compilation;
        const assetMap = {
          devFiles: [],
          clientPageDeps: {},
          clientPages: {}
        };

        const mainJsChunk = chunks.find(
          c => c.name === CLIENT_STATIC_FILES_RUNTIME_MAIN
        );
        const mainJsFiles =
          mainJsChunk && mainJsChunk.files.length > 0
            ? mainJsChunk.files.filter(file => /\.js$/.test(file))
            : [];

        for (const filePath of Object.keys(compilation.assets)) {
          const path = filePath.replace(/\\/g, "/");
          if (/^static\/development\/dll\//.test(path)) {
            assetMap.devFiles.push(path);
          }
        }

        // compilation.entrypoints is a Map object, so iterating over it 0 is the key and 1 is the value
        for (const [, entrypoint] of compilation.entrypoints.entries()) {
          const result = ROUTE_NAME_REGEX.exec(entrypoint.name);
          if (!result || !result[1]) {
            continue;
          }

          const pagePath = `/${result[1].replace(/\\/g, "/")}`;

          const filesForEntry = [];
          for (const chunk of entrypoint.chunks) {
            // If there's no name or no files
            if (!chunk.name || !chunk.files) {
              continue;
            }

            for (const file of chunk.files) {
              if (/\.map$/.test(file) || /\.hot-update\.js$/.test(file)) {
                continue;
              }

              // Only `.js` and `.css` files are added for now. In the future we can also handle other file types.
              if (!/\.js$/.test(file) && !/\.css$/.test(file)) {
                continue;
              }

              // The page bundles are manually added to _document.js as they need extra properties
              if (IS_BUNDLED_PAGE_REGEX.exec(file)) {
                assetMap.clientPages[pagePath] = file.replace(/\\/g, "/");
                continue;
              }

              filesForEntry.push(file.replace(/\\/g, "/"));
            }
          }

          assetMap.clientPageDeps[pagePath] = [
            ...filesForEntry,
            ...mainJsFiles
          ];
        }

        if (typeof assetMap.clientPageDeps["/index"] !== "undefined") {
          assetMap.clientPageDeps["/"] = assetMap.clientPageDeps["/index"];
        }

        if (typeof assetMap.clientPages["/index"] !== "undefined") {
          assetMap.clientPages["/"] = assetMap.clientPages["/index"];
        }

        assetMap.clientPageDeps = Object.keys(assetMap.clientPageDeps)
          .sort()
          .reduce((a, c) => ((a[c] = assetMap.clientPageDeps[c]), a), {});

        assetMap.clientPages = Object.keys(assetMap.clientPages)
          .sort()
          .reduce((a, c) => ((a[c] = assetMap.clientPages[c]), a), {});

        compilation.assets[CLIENT_BUILD_MANIFEST] = new RawSource(
          JSON.stringify(assetMap, null, 2)
        );
        callback();
      }
    );
  }
};
