# Obsidian Google Drive Sync Plugin

This plugin allows you to sync your Obsidian vault with Google Drive with automatic two-way synchronization, conflict resolution, and support for all file types.

## Features

- **Two-way sync**: Automatically sync changes in both directions
- **Incremental sync**: Only sync files that have been modified since last sync
- **Automatic sync**: Sync on file changes and at configurable intervals
- **Conflict resolution**: Choose how to handle conflicts when files are modified in both places
- **All file types**: Sync not just markdown files, but all files in your vault
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

The plugin shows sync status in Obsidian's status bar with emojis:
- ✅ "Ready" - Plugin loaded and ready
- 🔄 "Syncing..." - Currently syncing
- ✅ "Synced HH:MM" - Last successful sync time
- ❌ "Sync failed" - Last sync encountered an error

## Usage Tips

- Enable auto-sync for seamless synchronization
- Use "Sync Both Ways" for manual full sync
- Check the status bar for sync status
- Conflicts are handled according to your conflict resolution setting
- All file types in your vault are supported (not just .md files)
