import builder from 'electron-builder';
import { stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// Keep the installer as the original electron-builder NSIS executable.
// The former C# WebView2 wrapper embedded and extracted a second EXE in a
// temporary directory, behavior that can be flagged by antivirus heuristics.
const { Arch, Platform, build } = builder;
const output = resolve(process.argv[2] ?? 'dist/setup');

await build({
  targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64),
  publish: 'never',
  config: {
    appId: 'Wintermas',
    directories: { output },
    electronDist: resolve('node_modules/electron/dist'),
    electronLanguages: ['en-US'],
    npmRebuild: false,
    asar: true,
    files: ['main.js', 'diagnostics.js', 'preload.cjs', 'ui/**/*'],
    extraResources: [{ from: 'native/desktop.exe', to: 'native/desktop.exe' }],
    // No publisher certificate is configured: this output is NOT signed.
    // Signing requires a legitimate Authenticode certificate and cannot be
    // replaced by changing an icon or by suppressing antivirus alerts.
    win: { icon: 'ui/icon.png', signExecutable: false },
    nsis: {
      artifactName: 'Wintermas-Setup.exe',
      oneClick: false,
      perMachine: false,
      allowToChangeInstallationDirectory: true,
      differentialPackage: false,
      runAfterFinish: false,
    },
  },
});

const executable = join(output, 'Wintermas-Setup.exe');
const { size } = await stat(executable);
console.log(executable + ' (' + (size / 1024 ** 2).toFixed(1) + ' MiB)');
