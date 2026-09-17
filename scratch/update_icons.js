const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = 'C:\\Users\\lagacepe\\Desktop\\Cassetto-Win95-AudioRecorder';
const iconSetDir = path.join(rootDir, 'Cassetto-Application-Icons', 'cassetto-iconset');
const assetsDir = path.join(rootDir, 'assets');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Source files
const srcIco = path.join(iconSetDir, 'windows', 'Cassetto.ico');
const srcPng = path.join(iconSetDir, 'windows', 'png', 'Cassetto-256.png');
const srcIcns = path.join(iconSetDir, 'macos', 'Cassetto.icns');

// Dest files
const destIco = path.join(assetsDir, 'cassette.ico');
const destIcoUpper = path.join(assetsDir, 'Cassetto.ico');
const destPng = path.join(assetsDir, 'cassette.png');
const destPngUpper = path.join(assetsDir, 'Cassetto.png');
const destIcns = path.join(assetsDir, 'cassette.icns');

if (fs.existsSync(srcIco)) {
  fs.copyFileSync(srcIco, destIco);
  fs.copyFileSync(srcIco, destIcoUpper);
  console.log('Copied Cassetto.ico -> assets/cassette.ico');
}

if (fs.existsSync(srcPng)) {
  fs.copyFileSync(srcPng, destPng);
  fs.copyFileSync(srcPng, destPngUpper);
  console.log('Copied Cassetto-256.png -> assets/cassette.png');
}

if (fs.existsSync(srcIcns)) {
  fs.copyFileSync(srcIcns, destIcns);
  console.log('Copied Cassetto.icns -> assets/cassette.icns');
}

// Update shortcut icons
const userDesktop = path.join(process.env.USERPROFILE || 'C:\\Users\\lagacepe', 'Desktop');
const desktopShortcut = path.join(userDesktop, 'Cassetto Audio Recorder.lnk');
const rootShortcut = path.join(rootDir, 'Cassetto Audio Recorder.lnk');
const rootExe = path.join(rootDir, 'Cassetto.exe');

const psScriptPath = path.join(rootDir, 'scratch', 'update_icons.ps1');
const scriptContent = `
$w = New-Object -ComObject WScript.Shell

$s1 = $w.CreateShortcut('${desktopShortcut.replace(/'/g, "''")}')
$s1.TargetPath = '${rootExe.replace(/'/g, "''")}'
$s1.WorkingDirectory = '${rootDir.replace(/'/g, "''")}'
$s1.IconLocation = '${destIco.replace(/'/g, "''")}'
$s1.Description = 'Cassetto - Win95 Audio Recorder'
$s1.Save()

$s2 = $w.CreateShortcut('${rootShortcut.replace(/'/g, "''")}')
$s2.TargetPath = '${rootExe.replace(/'/g, "''")}'
$s2.WorkingDirectory = '${rootDir.replace(/'/g, "''")}'
$s2.IconLocation = '${destIco.replace(/'/g, "''")}'
$s2.Description = 'Cassetto - Win95 Audio Recorder'
$s2.Save()

Write-Host "Shortcut icons updated."
`;

fs.writeFileSync(psScriptPath, scriptContent, 'utf8');
execSync(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`, { encoding: 'utf8' });
console.log('Shortcuts updated successfully.');
