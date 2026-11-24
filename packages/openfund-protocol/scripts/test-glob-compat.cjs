const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createRequire } = require("node:module");
const Mocha = require("mocha");
const lookupFiles = require("mocha/lib/cli/lookup-files.js");
const mochaRequire = createRequire(require.resolve("mocha/package.json"));
assert.match(require("hardhat/package.json").version, /^2\./);
assert.equal(mochaRequire("glob/package.json").version, "14.0.6");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "openfund-glob-compat-"));
(async () => {
  try {
    fs.mkdirSync(path.join(root, "nested"));
    for (const name of ["a.test.cjs", "nested/b.test.cjs"]) {
      fs.writeFileSync(path.join(root, name), 'const assert = require("node:assert/strict"); describe("glob fixture", () => { it("loads through Mocha", () => assert.equal(2 + 2, 4)); });\n');
    }
    fs.writeFileSync(path.join(root, ".hidden.test.cjs"), 'throw new Error("hidden fixture must not load");\n');
    const expected = [path.join(root, "a.test.cjs"), path.join(root, "nested/b.test.cjs")].sort();
    assert.deepEqual(lookupFiles(path.join(root, "**/*.test.cjs"), ["cjs"], false).sort(), expected);
    assert.deepEqual(lookupFiles(root, ["cjs"], true).sort(), expected);
    assert.throws(() => lookupFiles(path.join(root, "missing-*.cjs"), ["cjs"], false), /Cannot find any files matching pattern/);
    const mocha = new Mocha({ reporter: "spec" });
    for (const file of expected) mocha.addFile(file);
    const failures = await new Promise(resolve => mocha.run(resolve));
    assert.equal(failures, 0);
    console.log("Mocha discovery and execution passed with glob 14.0.6 and Hardhat 2.");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
