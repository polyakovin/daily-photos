import assert from 'node:assert/strict';
import test from 'node:test';
import {
  patchExpoCliSigningSource,
  patchExpoModulesJsiSource
} from '../scripts/patch-expo-modules-jsi.ts';

const brokenSource = [
  'func dateFromMilliseconds(_ milliseconds: Double) throws -> Date {',
  '  guard milliseconds.isFinite, abs(milliseconds) <= maxJavaScriptDateMilliseconds else {',
  '    throw InvalidDateException()',
  '  }',
  '}'
].join('\n');

test('qualifies Swift abs in ExpoModulesJSI for Xcode 26.2', () => {
  const patched = patchExpoModulesJsiSource(brokenSource);
  assert.equal(patched.result, 'patched');
  assert.match(patched.source, /Swift\.abs\(milliseconds\)/);
  assert.doesNotMatch(patched.source, /, abs\(milliseconds\)/);
});

test('keeps the ExpoModulesJSI workaround idempotent', () => {
  const first = patchExpoModulesJsiSource(brokenSource);
  const second = patchExpoModulesJsiSource(first.source);
  assert.equal(second.result, 'already-patched');
  assert.equal(second.source, first.source);
});

test('leaves a changed upstream implementation untouched', () => {
  const source = 'func dateFromMilliseconds(_ milliseconds: Double) throws -> Date { Date() }';
  assert.deepEqual(patchExpoModulesJsiSource(source), {
    result: 'upstream-changed',
    source
  });
});

test('disables Expo CLI parallel CocoaPods signing to avoid unsigned frameworks', () => {
  const source = "const args = ['COCOAPODS_PARALLEL_CODE_SIGN=true'];";
  const patched = patchExpoCliSigningSource(source);
  assert.equal(patched.result, 'patched');
  assert.equal(patched.source, "const args = ['COCOAPODS_PARALLEL_CODE_SIGN=false'];");
  assert.equal(patchExpoCliSigningSource(patched.source).result, 'already-patched');
});
