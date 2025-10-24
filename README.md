# Obsidian Google Drive Sync Plugin

This plugin allows you to sync your Obsidian vault with Google Drive with automatic two-way synchronization, conflict resolution, and support for all file types.

## Features

- **Two-way sync**: Automatically sync changes in both directions
- **Incremental sync**: Only sync files that have been modified since last sync for better performance and reduced API usage
- **Automatic sync**: Sync on file changes and at configurable intervals
- **Conflict resolution**: Choose how to handle conflicts when files are modified in both places
- **All file types**: Sync not just markdown files, but all files in your vault including images, PDFs, and binary files
- **Status indicator**: See sync status in the status bar
- **Manual controls**: Manual sync commands for one-way or bidirectional sync

## Installation

### From Obsidian Community Plugins (Recommended)
1. Open Obsidian Settings
2. Go to Community Plugins and disable Safe Mode
3. Browse for "Google Drive Sync" and install

### Manual Installation
1. Download the latest release from GitHub
2. Extract the files to `VaultFolder/.obsidian/plugins/obsidian-google-drive-sync/`
3. Reload plugins in Obsidian

## Setup

1. Create a Google Cloud Project at https://console.cloud.google.com/
2. Enable the Google Drive API
3. Create OAuth 2.0 credentials (Desktop application)
4. Copy the Client ID and Client Secret
5. In Obsidian, go to Settings > Community plugins > Google Drive Sync
6. Enter Client ID and Client Secret in the settings
7. Create a folder in Google Drive and copy its ID from the URL
8. Enter the Folder ID in settings
9. Use the "Authenticate with Google Drive" command to login
10. Configure auto-sync settings as desired

## Settings

- **Client ID/Secret**: Your Google OAuth credentials
- **Folder ID**: ID of the Google Drive folder to sync with
- **Sync Interval**: How often to sync automatically (5-120 minutes)
- **Auto Sync**: Enable automatic sync on file changes and intervals
- **Conflict Resolution**:
  - **Overwrite with local**: Upload local changes (recommended)
  - **Keep local**: Don't sync conflicting files
  - **Keep remote**: Download remote changes
  - **Ask**: Show interactive modal to choose which version to keep

## Commands

- **Authenticate with Google Drive**: Opens browser for OAuth, paste the code in the modal
- **Sync Vault to Google Drive**: Upload local changes only
- **Sync Vault from Google Drive**: Download remote changes only
- **Sync Both Ways**: Full bidirectional sync

## Status Bar

The plugin shows sync status in Obsidian's status bar with minimal icons:
- ✓ "Ready" - Plugin loaded and ready
- ⠋⠙⠹... "Syncing..." - Animated spinner during sync
- ✓ "Synced - X↑ Y↓ Z🗑 W⚠" - Sync results (uploads/downloads/deletions/conflicts)
- ✗ "Sync failed" - Last sync encountered an error

## Supported File Types

The plugin supports all file types in your Obsidian vault:

### Text Files
- **Markdown** (.md) - Your notes and documents
- **Plain Text** (.txt) - Simple text files
- **JSON** (.json) - Configuration and data files

### Images
- **PNG** (.png) - Portable Network Graphics
- **JPEG/JPG** (.jpg, .jpeg) - Joint Photographic Experts Group
- **GIF** (.gif) - Graphics Interchange Format
- **SVG** (.svg) - Scalable Vector Graphics

### Documents
- **PDF** (.pdf) - Portable Document Format

### Other Files
- Any other file type in your vault will be synced as binary data

## Usage Tips

- Enable auto-sync for seamless synchronization
- Use "Sync Both Ways" for manual full sync
- Check the status bar for sync status
- Conflicts are handled according to your conflict resolution setting
- **Images work perfectly** - embed them in notes and they'll sync automatically
- Large files may take longer to sync depending on your internet connection
- **Debug logging** - Check the developer console (Ctrl+Shift+I) for detailed sync information

## Development

### Building
```bash
npm install
npm run build
```

### Release
```bash
npm run release:windows  # Windows
npm run release         # Unix/Linux/macOS
```

This creates a `release/` directory with all files needed for distribution.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.
