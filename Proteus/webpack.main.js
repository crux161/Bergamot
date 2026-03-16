const path = require("path");

const commonConfig = {
  mode: "development",
  resolve: {
    extensions: [".ts", ".js"],
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
