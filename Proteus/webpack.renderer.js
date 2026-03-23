const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: "development",
  target: "web",
  entry: "./src/renderer/index.tsx",
  output: {
    path: path.resolve(__dirname, "dist/renderer"),
    filename: "renderer.js",
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js", ".jsx"],
    alias: {
      "@": path.resolve(__dirname, "src/renderer"),
      "@bergamot/contracts": path.resolve(__dirname, "../packages/contracts/src"),
      "@bergamot/config": path.resolve(__dirname, "../packages/config/src"),
      "@bergamot/ui-tokens": path.resolve(__dirname, "../packages/ui-tokens/src"),
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.module\.css$/,
        use: [
          "style-loader",
          {
            loader: "css-loader",
            options: {
              modules: {
                localIdentName: "[name]__[local]__[hash:base64:5]",
                namedExport: false,
              },
            },
          },
        ],
      },
      {
        test: /\.css$/,
        exclude: /\.module\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.scss$/,
        use: [
          "style-loader",
          "css-loader",
          {
            loader: "sass-loader",
            options: {
              sassOptions: {
                silenceDeprecations: ["import"],
              },
            },
          },
        ],
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: "asset/resource",
        generator: {
          filename: "fonts/[name][ext]",
        },
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif|ico)$/,
        type: "asset/resource",
      },
    ],
  },
  watchOptions: {
    aggregateTimeout: 300,
    poll: 1000,
    ignored: /node_modules|dist|release|\.test-dist/,
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/renderer/index.html",
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: "public", to: ".", noErrorOnMissing: true },
      ],
    }),
  ],
  devServer: {
    host: "127.0.0.1",
    port: 3000,
    hot: true,
    static: [
      {
        directory: path.resolve(__dirname, "dist/renderer"),
        watch: false,
      },
      {
        directory: path.resolve(__dirname, "public"),
        publicPath: "/",
        watch: false,
      },
    ],
    client: {
      overlay: {
        errors: true,
        warnings: false,
      },
    },
  },
};
