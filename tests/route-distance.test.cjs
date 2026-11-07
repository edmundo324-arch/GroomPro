const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = readFileSync(path.join(__dirname, '../src/lib/route-distance.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const compiled = {};
new Function('exports', code)(compiled);
const { shortestDrivingOrder } = compiled;

test('the shortest drive honors both endpoints and directed road distances', () => {
  // A is the nearest first stop, but B → A → C is the shortest complete drive.
  const distances = [
    [0, 1, 3, 8, 9],
    [5, 0, 15, 2, 8],
    [5, 1, 0, 15, 8],
    [5, 5, 8, 0, 1],
    [9, 9, 9, 9, 0],
  ];
  assert.deepEqual(shortestDrivingOrder(distances), [1, 0, 2]);
  distances[3][4] = Infinity;
  assert.deepEqual(shortestDrivingOrder(distances), [0, 2, 1]);
});

test('an unreachable appointment does not receive a made-up route number', () => {
  assert.throws(() => shortestDrivingOrder([[0, 1, 1], [1, 0, Infinity], [1, 1, 0]]), /could not reach/);
});
