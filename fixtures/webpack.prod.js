class DemoPlugin {
  constructor(name) {
    this.name = name;
  }
}

module.exports = () => ({
  mode: "production",
  output: {
    filename: "bundle-[contenthash].js",
    path: "/home/bob/project/public/packs",
  },
  optimization: {
    minimize: true,
    minimizer: [() => "swc"],
  },
  plugins: [new DemoPlugin("demo")],
});
