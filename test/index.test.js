const test = require("tape");
const tt = require("../consulea"); // test target

test("makeConsulConfig()", (t) => {
  t.equal(typeof tt.makeConsulConfig, "function", "Function exists");
  let configIn = {};
  let envObj = {};
  let consulConfig = {};

  configIn = {};
  envObj = {};
  consulConfig = tt.makeConsulConfig(configIn, envObj);
  t.deepEqual(consulConfig, {}, "Empty configIn, no env");

  configIn = {};
  envObj = { CONSUL_HTTP_ADDR: "http://localhost:8500" };
  consulConfig = tt.makeConsulConfig(configIn, envObj);
  t.deepEqual(consulConfig, { host: "localhost", port: "8500", secure: false }, "Empty configIn, with env");

  configIn = {};
  envObj = { CONSUL_HTTP_ADDR: "https://localhost:8500" };
  consulConfig = tt.makeConsulConfig(configIn, envObj);
  t.deepEqual(consulConfig, { host: "localhost", port: "8500", secure: true }, "Empty configIn, with env +SECURE");

  configIn = { consulToken: "e417be15-17df-47a6-af5d-5b97b15fadf4" };
  envObj = { CONSUL_HTTP_ADDR: "http://consulserver.com:8500" };
  consulConfig = tt.makeConsulConfig(configIn, envObj);
  t.deepEqual(consulConfig, { host: "consulserver.com", port: "8500", secure: false, defaults: {
    token: "e417be15-17df-47a6-af5d-5b97b15fadf4"
  } }, "With token and env");

  configIn = {
    consulClientConfig: { host: "consulserver.com", port: "8500", secure: true },
  };
  envObj = {};
  consulConfig = tt.makeConsulConfig(configIn, envObj);
  t.deepEqual(consulConfig, { host: "consulserver.com", port: "8500", secure: true }, "With consulClientConfig, no env");

  configIn = {
    consulClientConfig: { host: "consulserver.com", port: "8500", secure: true },
    consulToken: "e417be15-17df-47a6-af5d-5b97b15fadf4",
  };
  envObj = {};
  consulConfig = tt.makeConsulConfig(configIn, envObj);
  t.deepEqual(consulConfig, {
    host: "consulserver.com",
    port: "8500",
    secure: true,
    defaults: {
      token: "e417be15-17df-47a6-af5d-5b97b15fadf4"
    }
  }, "With consulClientConfig+token, no env");

  t.end();
});

test("parseConsul()", (t) => {
  t.equal(typeof tt.parseConsul, "function", "Function exists");
  let kvData = {};
  let dataIn = [];
  let prefix = "";
  let parsed = {};

  kvData = {};
  dataIn = [];
  prefix = "";
  parsed = tt.parseConsul(kvData, dataIn, prefix);
  t.deepEqual(parsed, {}, "Empty dataIn, no prefix");

  kvData = {};
  dataIn = [];
  prefix = "cfg/vast-service/";
  parsed = tt.parseConsul(kvData, dataIn, prefix);
  t.deepEqual(parsed, {}, "Empty dataIn, prefix");

  kvData = {};
  dataIn = [
    { Key: "cfg/vast-service/foo", Value: "bar" }
  ];
  prefix = "";
  parsed = tt.parseConsul(kvData, dataIn, prefix);
  t.deepEqual(parsed, { "cfg/vastService/foo": "bar" }, "1 dataIn, no prefix");

  kvData = {};
  dataIn = [
    { Key: "cfg/vast-service/foo", Value: "bar" }
  ];
  prefix = "cfg/vast-service/";
  parsed = tt.parseConsul(kvData, dataIn, prefix);
  t.deepEqual(parsed, { foo: "bar" }, "1 dataIn, prefix");

  kvData = {};
  dataIn = [
    { Key: "cfg/vast-service/foo", Value: "bar" },
    { Key: "cfg/vast-service/bar", Value: "123" },
  ];
  prefix = "cfg/vast-service/";
  parsed = tt.parseConsul(kvData, dataIn, prefix);
  t.deepEqual(parsed, { foo: "bar", bar: "123" }, "2 dataIn, prefix");

  kvData = {};
  dataIn = [
    { Key: "cfg/vast-service/foo", Value: "bar" },
    { Key: "cfg/vast-service/bar", Value: "123" },
    { Key: "cfg/vast-service/qaz", Value: "true" },
  ];
  prefix = "cfg/vast-service/";
  parsed = tt.parseConsul(kvData, dataIn, prefix);
  t.deepEqual(parsed, { foo: "bar", bar: "123", qaz: "true" }, "3 dataIn, prefix");

  kvData = { foo: "bar" };
  dataIn = [
    { Key: "cfg/vast-service/bar", Value: "123" },
    { Key: "cfg/vast-service/qaz", Value: "true" },
  ];
  prefix = "cfg/vast-service/";
  parsed = tt.parseConsul(kvData, dataIn, prefix);
  t.deepEqual(parsed, { foo: "bar", bar: "123", qaz: "true" }, "2 dataIn, 1 kvData, prefix");

  kvData = { foo: "bar", bar: "123", qaz: "true", biz: "baz"};
  dataIn = [
    { Key: "cfg/vast-service/bar", Value: "456" },
    { Key: "cfg/vast-service/qaz", Value: "true" },
    { Key: "cfg/vast-service/biz", Value: "baz" },
    { Key: "cfg/vast-service/ape", Value: "big" },
  ];
  prefix = "cfg/vast-service/";
  parsed = tt.parseConsul(kvData, dataIn, prefix);
  t.deepEqual(parsed, { foo: "bar", bar: "456", qaz: "true", biz: "baz", ape: "big" }, "4 dataIn, 4 kvData, prefix, overlapping");

  t.end();
});

test("parseEnv()", (t) => {
  t.equal(typeof tt.parseEnv, "function", "Function exists");
  let kvdata = {};
  let envObj = {};
  let parsed = {};

  kvdata = {};
  envObj = {};
  parsed = tt.parseEnv(kvdata, envObj);
  t.deepEqual(parsed, {}, "Empty env, no prefix");

  kvdata = {};
  envObj = {};
  parsed = tt.parseEnv(kvdata, envObj, "TEST");
  t.deepEqual(parsed, {}, "Empty env, prefix");

  kvdata = {};
  envObj = { "TEST_FOO": "bar" };
  parsed = tt.parseEnv(kvdata, envObj);
  t.deepEqual(parsed, {}, "1 env, no prefix");

  kvdata = {};
  envObj = { "TEST_FOO": "bar" };
  parsed = tt.parseEnv(kvdata, envObj, "TEST");
  t.deepEqual(parsed, { foo: "bar" }, "1 env, prefix");

  kvdata = {};
  envObj = { "TEST_FOO": "bar", "TEST_LONG_STRING": "123" };
  parsed = tt.parseEnv(kvdata, envObj, "TEST");
  t.deepEqual(parsed, { foo: "bar", longString: "123" }, "2 env, prefix");

  t.end();
});

test("parseArgs()", (t) => {
  t.equal(typeof tt.parseArgs, "function", "Function exists");
  let args = [];
  let kvdata = {};
  let parsed = {};

  kvdata = {};
  args = ["node", "index.js", "--foo=bar"];
  parsed = tt.parseArgs(kvdata, args);
  t.deepEqual(parsed, { foo: "bar" }, "1 arg");

  kvdata = { "foo": "bar" };
  args = ["node", "index.js", "--biz=baz"];
  parsed = tt.parseArgs(kvdata, args);
  t.deepEqual(parsed, { foo: "bar", biz: "baz" }, "1 arg + 1 kvdata");

  kvdata = { "foo": "bar", "biz": "baz" };
  args = ["node", "index.js", "--foo=BAR", "--ape=big"];
  parsed = tt.parseArgs(kvdata, args);
  t.deepEqual(parsed, { foo: "BAR", biz: "baz", ape: "big" }, "2 args + 2 kvdata overlapping");

  kvdata = {};
  args = ["node", "index.js", "--convert-to-camel-case=123"];
  parsed = tt.parseArgs(kvdata, args);
  t.deepEqual(parsed, { convertToCamelCase: "123" }, "camelCase conversion");

  t.end();
});

test("findMissingKeys()", (t) => {
  t.equal(typeof tt.findMissingKeys, "function", "Function exists");
  let config = {};
  let requiredKeys = [];
  let missingKeys = [];

  config = { foo: "bar", bar: "123", qaz: "true" };
  requiredKeys = ["foo", "bar", "qaz"];
  missingKeys = tt.findMissingKeys(config, requiredKeys);
  t.deepEqual(missingKeys, [], "No missing keys");

  config = { foo: "bar", bar: "123" };
  requiredKeys = ["foo", "bar", "qaz"];
  missingKeys = tt.findMissingKeys(config, requiredKeys);
  t.deepEqual(missingKeys, ["qaz"], "Missing keys");

  config = { foo: "bar", bar: "123" };
  requiredKeys = [];
  missingKeys = tt.findMissingKeys(config, requiredKeys);
  t.deepEqual(missingKeys, [], "Empty required keys");

  config = {};
  requiredKeys = ["foo", "bar", "qaz"];
  missingKeys = tt.findMissingKeys(config, requiredKeys);
  t.deepEqual(missingKeys, ["foo", "bar", "qaz"], "Empty config");

  config = {};
  requiredKeys = [];
  missingKeys = tt.findMissingKeys(config, requiredKeys);
  t.deepEqual(missingKeys, [], "Empty config and required keys");

  t.end();
});

test("findChangedKeys()", (t) => {
  t.equal(typeof tt.findChangedKeys, "function", "Function exists");
  let self = {};

  self = {
    lastGoodKvData: {},
    kvData: {},
    config: {
      consulPrefix: "cfg/vast-service/"
    }
  };
  let changedKeys = tt.findChangedKeys(self);
  t.deepEqual(changedKeys, [], "Empty kvData");

  self = {
    lastGoodKvData: {},
    kvData: {
      "cfg/vast-service/foo": "bar"
    },
    config: {
      consulPrefix: "cfg/vast-service/"
    }
  };
  changedKeys = tt.findChangedKeys(self);
  t.deepEqual(changedKeys, ["foo"], "1 kvData");

  self = {
    lastGoodKvData: {
      "cfg/vast-service/foo": "bar"
    },
    kvData: {
      "cfg/vast-service/foo": "bar"
    },
    config: {
      consulPrefix: "cfg/vast-service/"
    }
  };
  changedKeys = tt.findChangedKeys(self);
  t.deepEqual(changedKeys, [], "1 kvData, no change");

  self = {
    lastGoodKvData: {
      "cfg/vast-service/foo": "bar"
    },
    kvData: {
      "cfg/vast-service/foo": "BAR"
    },
    config: {
      consulPrefix: "cfg/vast-service/"
    }
  };
  changedKeys = tt.findChangedKeys(self);
  t.deepEqual(changedKeys, ["foo"], "1 kvData, change");

  self = {
    lastGoodKvData: {
      "cfg/vast-service/foo": "bar"
    },
    kvData: {
      "cfg/vast-service/foo": "bar",
      "cfg/vast-service/bar": "123"
    },
    config: {
      consulPrefix: "cfg/vast-service/"
    }
  };
  changedKeys = tt.findChangedKeys(self);
  t.deepEqual(changedKeys, ["bar"], "2 kvData, 1 change");

  self = {
    lastGoodKvData: {
      "cfg/vast-service/foo": "bar"
    },
    kvData: {
      "cfg/vast-service/foo": "bar",
      "cfg/vast-service/bar": "123",
      "cfg/vast-service/qaz": "true"
    },
    config: {
      consulPrefix: "cfg/vast-service/"
    }
  };
  changedKeys = tt.findChangedKeys(self);
  t.deepEqual(changedKeys, ["bar", "qaz"], "3 kvData, 2 changes");

  t.end();
});

test("Consulea()", (t) => {
  t.equal(typeof tt.Consulea, "function", "Function exists");
  t.end();
});
