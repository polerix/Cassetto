const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = 'C:\\Users\\lagacepe\\Desktop\\Cassetto-Win95-AudioRecorder';
const unpackedDir = path.join(rootDir, 'dist', 'win-unpacked');
const targetExe = path.join(unpackedDir, 'Cassetto.exe');
const fallbackExe = path.join(unpackedDir, 'electron.exe');
const actualExe = fs.existsSync(targetExe) ? targetExe : fallbackExe;
const iconPath = path.join(rootDir, 'assets', 'cassette.ico');

// Remove old shortcut names if they exist
const userDesktop = path.join(process.env.USERPROFILE || 'C:\\Users\\lagacepe', 'Desktop');
const oldDesktopShortcut = path.join(userDesktop, 'Cassetto Audio Recorder.lnk');
const oldRootShortcut = path.join(rootDir, 'Cassetto Audio Recorder.lnk');
if (fs.existsSync(oldDesktopShortcut)) fs.unlinkSync(oldDesktopShortcut);
if (fs.existsSync(oldRootShortcut)) fs.unlinkSync(oldRootShortcut);

// Create Desktop shortcut named Cassetto.lnk
const desktopShortcut = path.join(userDesktop, 'Cassetto.lnk');

const psScriptPath = path.join(rootDir, 'scratch', 'make_lnk.ps1');
if (!fs.existsSync(path.join(rootDir, 'scratch'))) {
  fs.mkdirSync(path.join(rootDir, 'scratch'), { recursive: true });
}

const scriptContent = `
$w = New-Object -ComObject WScript.Shell

# Desktop Shortcut
$s1 = $w.CreateShortcut('${desktopShortcut.replace(/'/g, "''")}')
$s1.TargetPath = '${actualExe.replace(/'/g, "''")}'
$s1.WorkingDirectory = '${unpackedDir.replace(/'/g, "''")}'
$s1.IconLocation = '${iconPath.replace(/'/g, "''")}'
$s1.Description = 'Cassetto'
$s1.Save()

Write-Host "Desktop Shortcut created successfully."
`;

fs.writeFileSync(psScriptPath, scriptContent, 'utf8');

try {
  const out = execSync(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`, { encoding: 'utf8' });
  console.log('PowerShell Output:', out);
} catch (err) {
  console.error('Failed to run PS shortcut script:', err.message);
}
