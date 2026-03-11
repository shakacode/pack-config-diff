class DemoPlugin {
  constructor(name) {
    this.name = name
  }
}

module.exports = () => ({
  mode: "development",
  output: {
    filename: "bundle.js",
    path: "/Users/alice/project/public/packs"
  },
  optimization: {
    minimize: false,
    minimizer: [() => "terser"]
  },
  plugins: [new DemoPlugin("demo")]
})
