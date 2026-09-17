const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const distDir = path.join(__dirname, '..', 'dist');
const unpackedDir = path.join(distDir, 'win-unpacked');
const z7path = path.join(__dirname, '..', 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');

const targetZip = path.join(distDir, 'Cassetto.zip');
const target7z = path.join(distDir, 'Cassetto-Portable.7z');
const targetExe = path.join(distDir, 'Cassetto-Portable.exe');

console.log('Packaging Portable Release Files...');

if (!fs.existsSync(unpackedDir)) {
  console.error('Error: win-unpacked directory missing!');
  process.exit(1);
}

try {
  // 1. Create Portable ZIP Archive
  if (fs.existsSync(targetZip)) fs.unlinkSync(targetZip);
  console.log(`Building Portable ZIP: ${targetZip}`);
  execSync(`"${z7path}" a -tzip -mx=6 "${targetZip}" "${unpackedDir}\\*"`, { stdio: 'inherit' });

  // 2. Create Portable 7z & Self-Extracting EXE
  if (fs.existsSync(target7z)) fs.unlinkSync(target7z);
  console.log(`Building 7z Archive: ${target7z}`);
  execSync(`"${z7path}" a -t7z -mx=7 "${target7z}" "${unpackedDir}\\*"`, { stdio: 'inherit' });

  // Look for 7zSD.sfx or 7zCon.sfx module in 7zip-bin or node_modules
  const sfxPath = path.join(__dirname, '..', 'node_modules', '7zip-bin', 'win', 'x64', '7z.sfx');
  if (fs.existsSync(sfxPath)) {
    console.log(`Creating Self-Extracting Single-File EXE: ${targetExe}`);
    const sfxBuffer = fs.readFileSync(sfxPath);
    const z7Buffer = fs.readFileSync(target7z);

    // Write SFX Config Header + 7z payload
    const sfxConfig = `;ModuleID="7zSFX"\n;Title="Cassetto"\n;BeginPrompt="Launch Cassetto Portable?"\n;RunProgram="Cassetto.exe"\n;;\n`;
    const configBuffer = Buffer.from(sfxConfig, 'utf8');

    fs.writeFileSync(targetExe, Buffer.concat([sfxBuffer, configBuffer, z7Buffer]));
    console.log(`Successfully created Portable EXE: ${targetExe}`);
  } else {
    // Duplicate zip as .exe wrapper or keep zip portable executable
    console.log('Created Portable Release ZIP package ready for distribution.');
  }

  console.log('\n--- PORTABLE BUILD COMPLETE ---');
  console.log(`Output Directory: ${distDir}`);
  console.log(`- Portable ZIP: Cassetto.zip`);
  if (fs.existsSync(targetExe)) console.log(`- Single-File EXE: Cassetto-Portable.exe`);
} catch (err) {
  console.error('Packaging error:', err);
}
