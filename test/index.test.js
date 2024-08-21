var test = require("tape");
var tt = require("../consulea"); // test target

test("makeConsulConfig()", t => {
  t.equal(typeof tt.makeConsulConfig, "function", "Function exists");
  t.end();
});

test("parseConsul()", t => {
  t.equal(typeof tt.parseConsul, "function", "Function exists");
  t.end();
});

test("parseEnv()", t => {
  t.equal(typeof tt.parseEnv, "function", "Function exists");
  t.end();
});

test("parseArgs()", t => {
  t.equal(typeof tt.parseArgs, "function", "Function exists");
  t.end();
});

test("findMissingKeys()", t => {
  t.equal(typeof tt.findMissingKeys, "function", "Function exists");
  t.end();
});

test("findChangedKeys()", t => {
  t.equal(typeof tt.findChangedKeys, "function", "Function exists");
  t.end();
});

test("Consulea()", t => {
  t.equal(typeof tt.Consulea, "function", "Function exists");
  t.end();
});
