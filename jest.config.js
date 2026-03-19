module.exports = {
  testEnvironment: "node",
  testMatch: ["**/test/**/*.test.js"],
  moduleFileExtensions: ["js", "ts", "json"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
};
