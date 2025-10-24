# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-10-XX

### Added
- **Two-way synchronization**: Automatically sync changes in both directions
- **Incremental sync**: Only sync files modified since last sync for better performance and reduced API usage
- **Automatic sync**: Sync on file changes and at configurable intervals
- **Conflict resolution**: Multiple strategies for handling conflicting changes including interactive modal
- **Animated status bar**: Minimal icons with animated spinner during sync operations
- **Compact status feedback**: Sync results shown directly in status bar (no pop-up distractions)
- **Deletion sync**: Files deleted from Obsidian are automatically deleted from Google Drive
- **Support for all file types**: Sync images, PDFs, JSON, and all other files
- **Enhanced settings UI**: Sync interval slider, auto-sync toggle, conflict resolution dropdown
- **New commands**: "Sync Both Ways" for bidirectional sync
- **Better error handling**: Detailed logging and user-friendly error messages

### Changed
- Improved authentication flow with better error handling
- Status bar uses minimal Unicode icons instead of emojis for cleaner appearance
- Sync results displayed in status bar instead of disruptive pop-up notices
- Added animated spinner during sync operations
- Updated README with comprehensive documentation
- Version bump to 1.0.0 indicating stable release

### Fixed
- **Critical text file corruption bug**: Text files were being uploaded as binary data, causing Google Drive to display "{}" instead of actual content
- **Proper text/binary file handling**: Now correctly uses `read()` for text files and `readBinary()` for binary files
- **Google Drive API compatibility**: Fixed encoding/decoding issues between Obsidian and Google Drive

### Technical
- Refactored sync logic into unified `performSync` method
- Added proper TypeScript types and error handling
- Improved build process and package metadata
- Added comprehensive logging for debugging
- **Fixed binary file support**: Properly handles images, PDFs, and other binary files using readBinary/writeBinary methods
- **Enhanced MIME type detection**: Accurate handling of different file types for both upload and download

## [0.1.0] - 2024-10-XX

### Added
- Basic Google Drive authentication
- One-way sync from Obsidian to Google Drive
- Basic settings for credentials and folder ID
- Initial plugin structure and commands
