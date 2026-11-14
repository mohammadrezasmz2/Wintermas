import test from 'node:test';
import assert from 'node:assert/strict';
import { dropTreeAt, fallTree, treeBottomIsSafe } from '../ui/tree-physics.js';

const taskbarTop = () => 935;

test('drop inside application pins tree to TOP rather than where clicked', () => {
  const tree = dropTreeAt({ x: 500, y: 710 }, [
    { id: 'app', left: 200, top: 360, right: 1000, bottom: 840, taskbar: false }
  ]);
  assert.deepEqual(tree.anchor, { id: 'app', x: 300, y: 0 });
  assert.equal(tree.falling, false);
});

test('tree released in midair falls and stays on TOP of taskbar', () => {
  const tree = dropTreeAt({ x: 620, y: 550 }, []);
  assert.equal(tree.falling, true);
  for (let i=0;i<140;i++) {
    fallTree(tree, 1/60, [], taskbarTop);
    assert.ok(tree.anchor.y <= 935, 'tree cannot penetrate taskbar');
  }
  assert.equal(tree.anchor.y, 935);
  assert.equal(tree.vy, 0);
  assert.equal(tree.onBottom, true);
  assert.ok(treeBottomIsSafe(tree, taskbarTop, a=>a));
});

test('tree collides with an open window beneath it while falling', () => {
  const window = { id: 'W', left: 200, right: 950, top: 440, bottom: 860, taskbar: false };
  const tree = dropTreeAt({ x: 600, y: 390 }, [window]);
  assert.ok(tree.falling);
  for (let i=0;i<55 && tree.falling;i++) fallTree(tree, 1/60, [window], taskbarTop);
  assert.deepEqual(tree.anchor, { id: 'W', x: 400, y: 0 });
  assert.equal(tree.falling, false);
});

test('release below taskbar snaps back to the upper edge', () => {
  const tree = dropTreeAt({ x: 620, y: 976 }, []);
  fallTree(tree, 1/60, [], taskbarTop);
  assert.equal(tree.anchor.y, 935);
  assert.ok(treeBottomIsSafe(tree, taskbarTop, a=>a));
});

test('taskbar edge changes cause resting trees to follow', () => {
  const tree = dropTreeAt({ x: 620, y: 970 }, []);
  fallTree(tree, 1/60, [], taskbarTop);
  assert.equal(fallTree(tree, 1/60, [], () => 920), true);
  assert.equal(tree.anchor.y, 920);
  assert.equal(fallTree(tree, 1/60, [], () => 920), false);
});
