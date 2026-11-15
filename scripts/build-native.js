import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';

function frameworkAssembly(name) {
  const windows = process.env.WINDIR || 'C:\\Windows';
  const base = join(windows, 'Microsoft.NET');
  const roots = [
    join(base, 'assembly', 'GAC_MSIL', name),
    join(base, 'assembly', 'GAC_64', name),
    join(base, 'Framework64', 'v4.0.30319', 'WPF'),
    join(base, 'Framework', 'v4.0.30319', 'WPF'),
    join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
      'Reference Assemblies', 'Microsoft', 'Framework', '.NETFramework', 'v4.8'),
  ];
  for (const location of roots) {
    const direct = join(location, name + '.dll');
    if (existsSync(direct)) return direct;
    if (!existsSync(location)) continue;
    for (const version of readdirSync(location)) {
      const candidate = join(location, version, name + '.dll');
      if (existsSync(candidate)) return candidate;
    }
  }
  throw new Error('Missing .NET 4.x UIAutomation assembly: ' + name);
}

const compiler = join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
try {
  await promisify(execFile)(compiler, [
    '/nologo', '/optimize+',
    '/reference:System.Drawing.dll',
    '/reference:' + frameworkAssembly('WindowsBase'),
    '/reference:' + frameworkAssembly('UIAutomationClient'),
    '/reference:' + frameworkAssembly('UIAutomationTypes'),
    '/out:' + resolve('native', 'desktop.exe'),
    resolve('native', 'Desktop.cs'),
    resolve('native', 'DesktopIcons.cs'),
  ]);
} catch (error) {
  console.error(error.stdout || error.message);
  process.exitCode = 1;
}

