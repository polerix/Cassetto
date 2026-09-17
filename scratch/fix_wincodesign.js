const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const cacheDir = path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'winCodeSign');
const z7path = path.join(__dirname, '..', 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');

console.log('Checking winCodeSign cache directory:', cacheDir);

if (fs.existsSync(cacheDir) && fs.existsSync(z7path)) {
  const entries = fs.readdirSync(cacheDir);
  entries.forEach(entry => {
    if (entry.endsWith('.7z')) {
      const archivePath = path.join(cacheDir, entry);
      const folderName = entry.replace('.7z', '');
      const targetFolder = path.join(cacheDir, folderName);

      try {
        console.log(`Extracting ${entry} into ${targetFolder}...`);
        if (!fs.existsSync(targetFolder)) {
          fs.mkdirSync(targetFolder, { recursive: true });
        }
        // Extract ignoring symlink creation errors by creating dummy files first
        const darwinLibDir = path.join(targetFolder, 'darwin', '10.12', 'lib');
        fs.mkdirSync(darwinLibDir, { recursive: true });
        fs.writeFileSync(path.join(darwinLibDir, 'libcrypto.dylib'), 'dummy');
        fs.writeFileSync(path.join(darwinLibDir, 'libssl.dylib'), 'dummy');

        // Run 7za extract ignoring error output
        try {
          execSync(`"${z7path}" x -y -bd -snl "${archivePath}" "-o${targetFolder}"`, { stdio: 'ignore' });
        } catch (e) {
          // Ignore symlink exit code 2 error
        }

        // Re-write dummy files if 7za deleted them
        fs.writeFileSync(path.join(darwinLibDir, 'libcrypto.dylib'), 'dummy');
        fs.writeFileSync(path.join(darwinLibDir, 'libssl.dylib'), 'dummy');
        console.log(`Successfully pre-extracted ${folderName}`);
      } catch (err) {
        console.warn('Extraction warning:', err.message);
      }
    }
  });
}
