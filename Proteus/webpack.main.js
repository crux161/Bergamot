const path = require("path");

const commonConfig = {
  mode: "development",
  resolve: {
    extensions: [".ts", ".js"],
  },
  watchOptions: {
    aggregateTimeout: 300,
    poll: 1000,
    ignored: /node_modules|dist|release|\.test-dist/,
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  node: {
    __dirname: false,
    __filename: false,
  },
};

module.exports = [
  {
    ...commonConfig,
    target: "electron-main",
    entry: "./src/main/main.ts",
    output: {
      path: path.resolve(__dirname, "dist/main"),
      filename: "main.js",
    },
  },
  {
    ...commonConfig,
    target: "electron-preload",
    entry: "./src/main/preload.ts",
    output: {
      path: path.resolve(__dirname, "dist/main"),
      filename: "preload.js",
    },
  },
];
