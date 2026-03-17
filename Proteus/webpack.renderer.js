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
        test: /\.css$/,
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
    port: 3000,
    hot: true,
    static: [
      { directory: path.resolve(__dirname, "dist/renderer") },
      { directory: path.resolve(__dirname, "public"), publicPath: "/" },
    ],
    client: {
      overlay: {
        errors: true,
        warnings: false,
      },
    },
  },
};
