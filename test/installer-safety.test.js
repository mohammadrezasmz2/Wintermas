import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('preview installer is a direct NSIS build without nested C# wrapper', async () => {
  const pkg=await readFile(new URL('../scripts/package.js',import.meta.url),'utf8');
  assert.doesNotMatch(pkg,/\bwrapSetup\s*\(/);
  assert.doesNotMatch(pkg,/Wintermas-Engine\.exe/);
  assert.match(pkg,/artifactName:\s*'Wintermas-Setup\.exe'/);
  assert.match(pkg,/Platform\.WINDOWS\.createTarget\(\['nsis'\], Arch\.x64\)/);
});
test('build checks real EXE and attempts Windows installation before release', async () => {
  const ci=await readFile(new URL('../.github/workflows/preview-installer.yml',import.meta.url),'utf8');
  assert.match(ci,/Get-AuthenticodeSignature/);
  assert.match(ci,/Get-FileHash -Algorithm SHA256/);
  assert.match(ci,/Start-Process -FilePath \$installer/);
  assert.match(ci,/Test-Path \(Join-Path \$target 'Wintermas\.exe'\)/);
  assert.match(ci,/Wintermas-Setup\.exe\.sha256/);
});
