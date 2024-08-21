var test = require("tape");
var consulea = require("../consulea");

test("consulea()", t => {
  t.equal(typeof consulea, "function", "Function exists");
  t.end();
});
