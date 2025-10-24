const fs = require('fs');
const path = require('path');

// Try to find Obsidian vaults automatically
function findObsidianVaults() {
    const homeDir = require('os').homedir();
    const possiblePaths = [
        path.join(homeDir, 'Documents', 'Obsidian Vault'),
        path.join(homeDir, 'Documents', 'Obsidian'),
        path.join(homeDir, 'OneDrive', 'Obsidian'),
        path.join(homeDir, 'OneDrive', 'Documents', 'Obsidian Vault'),
        // Add more common locations
    ];

    const vaults = [];
    for (const vaultPath of possiblePaths) {
        if (fs.existsSync(vaultPath) && fs.statSync(vaultPath).isDirectory()) {
            const obsidianDir = path.join(vaultPath, '.obsidian');
            if (fs.existsSync(obsidianDir)) {
                vaults.push(vaultPath);
            }
        }
    }
    return vaults;
}

function installToVault(vaultPath) {
    const pluginDir = path.join(vaultPath, '.obsidian', 'plugins', 'obsidian-google-drive-sync');
    const destMainJs = path.join(pluginDir, 'main.js');
    const srcMainJs = path.join(__dirname, 'release', 'main.js');

    // Create plugin directory if it doesn't exist
    if (!fs.existsSync(pluginDir)) {
        fs.mkdirSync(pluginDir, { recursive: true });
        console.log('Created plugin directory:', pluginDir);
    }

    // Copy manifest and other files
    const filesToCopy = ['manifest.json', 'LICENSE', 'README.md'];
    for (const file of filesToCopy) {
        const src = path.join(__dirname, file);
        const dest = path.join(pluginDir, file);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
        }
    }

    // Copy main.js
    fs.copyFileSync(srcMainJs, destMainJs);
    console.log('✅ Plugin installed to vault:', vaultPath);
    console.log('📄 Files copied to:', pluginDir);
}

const vaults = findObsidianVaults();

if (vaults.length === 0) {
    console.log('❌ No Obsidian vaults found automatically.');
    console.log('Please set the OBSIDIAN_VAULT_PATH environment variable manually:');
    console.log('Example: set OBSIDIAN_VAULT_PATH="C:\\Users\\YourName\\Documents\\YourVault"');
    console.log('Then run: npm run install-vault');
} else if (vaults.length === 1) {
    console.log('Found Obsidian vault:', vaults[0]);
    installToVault(vaults[0]);
} else {
    console.log('Multiple vaults found:');
    vaults.forEach((vault, index) => {
        console.log(`${index + 1}. ${vault}`);
    });
    console.log('Please set OBSIDIAN_VAULT_PATH to the correct vault path.');
}
