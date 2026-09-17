import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BROKEN_EXPRESSION =
  'guard milliseconds.isFinite, abs(milliseconds) <= maxJavaScriptDateMilliseconds else {';
const FIXED_EXPRESSION =
  'guard milliseconds.isFinite, Swift.abs(milliseconds) <= maxJavaScriptDateMilliseconds else {';
const PARALLEL_SIGNING_ARGUMENT = 'COCOAPODS_PARALLEL_CODE_SIGN=true';
const SERIAL_SIGNING_ARGUMENT = 'COCOAPODS_PARALLEL_CODE_SIGN=false';

export type PatchResult = 'already-patched' | 'patched' | 'upstream-changed';

export function patchExpoModulesJsiSource(source: string): {
  result: PatchResult;
  source: string;
} {
  if (source.includes(FIXED_EXPRESSION)) {
    return { result: 'already-patched', source };
  }
  if (!source.includes(BROKEN_EXPRESSION)) {
    return { result: 'upstream-changed', source };
  }
  return {
    result: 'patched',
    source: source.replace(BROKEN_EXPRESSION, FIXED_EXPRESSION)
  };
}

export function patchInstalledExpoModulesJsi(projectRoot: string): PatchResult {
  const sourcePath = path.join(
    projectRoot,
    'node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Coding/JavaScriptCodable+Date.swift'
  );
  const source = readFileSync(sourcePath, 'utf8');
  const patched = patchExpoModulesJsiSource(source);
  if (patched.result === 'patched') {
    writeFileSync(sourcePath, patched.source);
  }
  return patched.result;
}

export function patchExpoCliSigningSource(source: string): {
  result: PatchResult;
  source: string;
} {
  if (source.includes(SERIAL_SIGNING_ARGUMENT)) {
    return { result: 'already-patched', source };
  }
  if (!source.includes(PARALLEL_SIGNING_ARGUMENT)) {
    return { result: 'upstream-changed', source };
  }
  return {
    result: 'patched',
    source: source.replace(PARALLEL_SIGNING_ARGUMENT, SERIAL_SIGNING_ARGUMENT)
  };
}

export function patchInstalledExpoCliSigning(projectRoot: string): PatchResult {
  const sourcePath = path.join(
    projectRoot,
    'node_modules/expo/node_modules/@expo/cli/build/src/run/ios/XcodeBuild.js'
  );
  const source = readFileSync(sourcePath, 'utf8');
  const patched = patchExpoCliSigningSource(source);
  if (patched.result === 'patched') {
    writeFileSync(sourcePath, patched.source);
  }
  return patched.result;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  const jsiResult = patchInstalledExpoModulesJsi(process.cwd());
  const signingResult = patchInstalledExpoCliSigning(process.cwd());
  console.log(`ExpoModulesJSI Xcode 26.2 workaround: ${jsiResult}`);
  console.log(`Expo CLI serial framework signing workaround: ${signingResult}`);
}
