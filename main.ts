import { Plugin, TFile, Notice, PluginSettingTab, Setting, App, Modal } from 'obsidian';
import { google } from 'googleapis';
import { Readable } from 'stream';

interface GoogleDriveSyncSettings {
	clientId: string;
	clientSecret: string;
	folderId: string;
	refreshToken: string;
	lastSyncTime: number;
	syncInterval: number; // in minutes
	autoSync: boolean;
	conflictResolution: 'overwrite' | 'keep-local' | 'keep-remote' | 'ask';
}

const DEFAULT_SETTINGS: GoogleDriveSyncSettings = {
	clientId: '',
	clientSecret: '',
	folderId: '',
	refreshToken: '',
	lastSyncTime: 0,
	syncInterval: 15, // 15 minutes
	autoSync: true,
	conflictResolution: 'overwrite'
}

export default class GoogleDriveSyncPlugin extends Plugin {
	settings: GoogleDriveSyncSettings;
	statusBarItem: HTMLElement;
	syncIntervalId: NodeJS.Timeout | null = null;
	syncAnimationId: NodeJS.Timeout | null = null;

	async onload() {
		console.log('Loading Google Drive Sync plugin');

		await this.loadSettings();

		// Add status bar item
		this.statusBarItem = this.addStatusBarItem();
		this.updateStatusBar('Ready');

		// Setup automatic sync
		this.setupAutoSync();

		// Add command to authenticate with Google Drive
		this.addCommand({
			id: 'authenticate-google-drive',
			name: 'Authenticate with Google Drive',
			callback: () => {
				this.authenticate();
			}
		});

		// Add command to sync vault to Google Drive
		this.addCommand({
			id: 'sync-to-google-drive',
			name: 'Sync Vault to Google Drive',
			callback: () => {
				this.performSync(true, false);
			}
		});

		// Add command to sync from Google Drive
		this.addCommand({
			id: 'sync-from-google-drive',
			name: 'Sync Vault from Google Drive',
			callback: () => {
				this.performSync(false, true);
			}
		});

		// Add command to sync both ways
		this.addCommand({
			id: 'sync-bidirectional',
			name: 'Sync Both Ways',
			callback: () => {
				console.log('Starting bidirectional sync (toDrive=true, fromDrive=true)');
				this.performSync(true, true);
			}
		});

		// Add settings tab
		this.addSettingTab(new GoogleDriveSyncSettingTab(this.app, this));
	}

	onunload() {
		console.log('Unloading Google Drive Sync plugin');
		if (this.syncIntervalId) {
			clearInterval(this.syncIntervalId);
		}
		if (this.syncTimeoutId) {
			clearTimeout(this.syncTimeoutId);
		}
		if (this.syncAnimationId) {
			clearInterval(this.syncAnimationId);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.setupAutoSync();
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private updateStatusBar(text: string) {
		let icon = '';
		switch (text) {
			case 'Ready':
				icon = '✓';
				break;
			case 'Sync failed':
				icon = '✗';
				break;
			default:
				if (text.startsWith('Synced')) {
					icon = '✓';
				}
				break;
		}
		this.statusBarItem.setText(`${icon} ${text}`);
	}

	private startSyncAnimation() {
		if (this.syncAnimationId) {
			clearInterval(this.syncAnimationId);
		}

		const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
		let frameIndex = 0;

		this.syncAnimationId = setInterval(() => {
			this.statusBarItem.setText(`${frames[frameIndex]} Syncing...`);
			frameIndex = (frameIndex + 1) % frames.length;
		}, 100);
	}

	private stopSyncAnimation() {
		if (this.syncAnimationId) {
			clearInterval(this.syncAnimationId);
			this.syncAnimationId = null;
		}
	}

	public setupAutoSync() {
		if (this.syncIntervalId) {
			clearInterval(this.syncIntervalId);
		}
		if (this.syncTimeoutId) {
			clearTimeout(this.syncTimeoutId);
			this.syncTimeoutId = null;
		}

		if (this.settings.autoSync && this.settings.refreshToken && this.settings.folderId) {
			this.syncIntervalId = setInterval(() => {
				this.performSync();
			}, this.settings.syncInterval * 60 * 1000); // Convert minutes to milliseconds

			// Also register for file change events
			this.registerEvent(this.app.vault.on('modify', () => {
				if (this.settings.autoSync) {
					// Debounce sync calls
					if (this.syncTimeoutId) {
						clearTimeout(this.syncTimeoutId);
					}
					this.syncTimeoutId = setTimeout(() => this.performSync(), 5000);
				}
			}));

			// Also register for file deletion events
			this.registerEvent(this.app.vault.on('delete', () => {
				if (this.settings.autoSync) {
					// Debounce sync calls
					if (this.syncTimeoutId) {
						clearTimeout(this.syncTimeoutId);
					}
					this.syncTimeoutId = setTimeout(() => this.performSync(), 5000);
				}
			}));

			// Also register for file creation events
			this.registerEvent(this.app.vault.on('create', () => {
				if (this.settings.autoSync) {
					// Debounce sync calls
					if (this.syncTimeoutId) {
						clearTimeout(this.syncTimeoutId);
					}
					this.syncTimeoutId = setTimeout(() => this.performSync(), 5000);
				}
			}));
		}
	}

	private syncTimeoutId: NodeJS.Timeout | null = null;

	private async performSync(toDrive: boolean = true, fromDrive: boolean = true) {
		if (!this.settings.refreshToken || !this.settings.folderId) {
			new Notice('Please authenticate and set Folder ID in settings');
			return;
		}

		try {
			this.startSyncAnimation();
			console.log('Starting Google Drive sync');

			const auth = this.getAuthClient();
			const tokenResponse = await auth.getAccessToken();
			const accessToken = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse.token;

			if (!accessToken) {
				throw new Error('No access token available');
			}

			// Validate folder exists and is accessible
			try {
				await this.validateDriveFolder(accessToken);
			} catch (error) {
				console.error('Drive folder validation failed:', error);
				new Notice(`Google Drive sync failed: ${error.message}`);
				this.stopSyncAnimation();
				return;
			}

			const drive = google.drive({ version: 'v3', auth });

			// Get all files from vault - use getFiles() for current vault state
			const vaultFiles = this.app.vault.getFiles();
			const vaultFileMap = new Map<string, TFile>();

			console.log(`Vault contains ${vaultFiles.length} files`);
			for (const file of vaultFiles) {
				vaultFileMap.set(file.name, file);
				console.log(`Vault file: ${file.name} (${file.stat.size} bytes)`);
				// Special logging for PDFs
				if (file.name.toLowerCase().endsWith('.pdf')) {
					console.log(`PDF detected: ${file.name}, size: ${file.stat.size}, mtime: ${new Date(file.stat.mtime).toISOString()}`);
				}
			}
			console.log(`Processing ${vaultFileMap.size} files from vault`);

			// Get all files from Google Drive
			const driveFiles = await this.getDriveFiles(accessToken);
			const driveFileMap = new Map<string, any>();

			console.log(`Drive contains ${driveFiles.length} files`);
			for (const file of driveFiles) {
				driveFileMap.set(file.name, file);
				console.log(`Drive file: ${file.name} (${file.size} bytes, modified: ${file.modifiedTime})`);
			}

			let deleted = 0;

			let uploaded = 0, downloaded = 0, conflicts = 0;
			const lastSync = this.settings.lastSyncTime;

			// Process vault files
			for (const file of vaultFiles) {
				if (!(file instanceof TFile)) continue;

				const driveFile = driveFileMap.get(file.name);
				const vaultMtime = file.stat.mtime;

				if (toDrive) {
					if (!driveFile) {
						// File doesn't exist on Drive, upload it
						console.log(`New file in vault: ${file.name} (${file.stat.size} bytes)`);
						await this.uploadFile(drive, file, accessToken);
						uploaded++;
					} else {
						// File exists, check if it has changed since last sync
						const driveMtime = new Date(driveFile.modifiedTime).getTime();

						// Only sync if the file has been modified since last sync (with small buffer)
						const vaultChanged = vaultMtime > lastSync + 2000; // 2 second buffer
						const driveChanged = driveMtime > lastSync + 2000;

						if (vaultChanged && driveChanged) {
							// Conflict: both modified since last sync
							await this.handleConflict(drive, file, driveFile, accessToken);
							conflicts++;
						} else if (vaultChanged) {
							// Only vault version changed, upload it
							await this.uploadFile(drive, file, accessToken, driveFile.id);
							uploaded++;
						}
						// If only drive changed, it will be handled in the drive files loop below
					}
				}
			}

			// Process Drive files
			if (fromDrive) {
				for (const driveFile of driveFiles) {
					const vaultFile = vaultFileMap.get(driveFile.name);

					if (!vaultFile) {
						// File doesn't exist in vault, check if it should be deleted or downloaded
						const driveMtime = new Date(driveFile.modifiedTime).getTime();

						console.log(`File ${driveFile.name} exists in Drive but not in vault`);
						console.log(`  Drive modified: ${new Date(driveMtime).toISOString()}`);
						console.log(`  Last sync: ${new Date(lastSync).toISOString()}`);
						console.log(`  Time diff: ${(driveMtime - lastSync) / 1000} seconds`);
						console.log(`  toDrive: ${toDrive}, fromDrive: ${fromDrive}`);

						// If the drive file was created/modified after our last sync, it might be new
						// If it was created before last sync, it might have been deleted from vault
						if (driveMtime > lastSync + 2000) {
							// File was added to Drive after last sync, download it (if we're doing downloads)
							if (fromDrive) {
								console.log(`  -> Downloading ${driveFile.name} (new file in Drive)`);
								await this.downloadFile(drive, driveFile, accessToken);
								downloaded++;
							} else {
								console.log(`  -> Skipping download of ${driveFile.name} (not doing download operations)`);
							}
						}
						// If file exists in Drive but not in vault and wasn't modified recently,
						// it was likely deleted from vault and should be deleted from Drive too
						else if (toDrive) {
							// Only delete if we're doing upload operations (two-way or one-way to Drive)
							console.log(`  -> Deleting ${driveFile.name} from Google Drive (deleted from vault)`);

							// Get access token and delete file using direct HTTP
							const tokenResponse = await auth.getAccessToken();
							const accessToken = tokenResponse.token || tokenResponse;

							if (accessToken) {
								const deleteUrl = `https://www.googleapis.com/drive/v3/files/${driveFile.id}`;
								const deleteResponse = await fetch(deleteUrl, {
									method: 'DELETE',
									headers: {
										'Authorization': `Bearer ${accessToken}`,
									},
								});

								if (deleteResponse.ok) {
									deleted++;
								} else {
									console.error(`Failed to delete ${driveFile.name}: ${deleteResponse.status} ${deleteResponse.statusText}`);
								}
							}
						} else {
							console.log(`  -> Skipping deletion of ${driveFile.name} (not doing upload operations)`);
						}
					} else {
						// File exists in both places, check if drive version is newer
						const driveMtime = new Date(driveFile.modifiedTime).getTime();
						const vaultMtime = vaultFile.stat.mtime;

						// Only sync if the drive file has been modified since last sync (with small buffer)
						const driveChanged = driveMtime > lastSync + 2000; // 2 second buffer
						const vaultChanged = vaultMtime > lastSync + 2000;

						if (driveChanged && vaultChanged) {
							// Already handled as conflict in vault files loop
							continue;
						} else if (driveChanged) {
							// Only drive version changed, download it
							await this.downloadFile(drive, driveFile, accessToken);
							downloaded++;
						}
						// If only vault changed, it was already handled in the vault files loop above
					}
				}
			}

			this.settings.lastSyncTime = Date.now();
			await this.saveSettings();

			// Stop animation and show results in status bar
			this.stopSyncAnimation();

			// Create appropriate status message based on what happened
			let statusMessage: string;
			if (uploaded === 0 && downloaded === 0 && conflicts === 0 && deleted === 0) {
				statusMessage = "Synced - No changes";
			} else {
				statusMessage = `Synced - ${uploaded}↑ ${downloaded}↓`;
				if (deleted > 0) {
					statusMessage += ` ${deleted}🗑`;
				}
				if (conflicts > 0) {
					statusMessage += ` ${conflicts}⚠`;
				}
			}

			this.updateStatusBar(statusMessage);

			// Log to console for debugging
			let logMessage: string;
			if (uploaded === 0 && downloaded === 0 && conflicts === 0 && deleted === 0) {
				logMessage = "Sync complete: No changes detected";
			} else {
				logMessage = `Sync complete: ${uploaded} uploaded, ${downloaded} downloaded`;
				if (deleted > 0) {
					logMessage += `, ${deleted} deleted`;
				}
				if (conflicts > 0) {
					logMessage += `, ${conflicts} conflict${conflicts === 1 ? '' : 's'} resolved`;
				}
			}
			console.log(logMessage);

		} catch (error) {
			console.error('Sync failed:', error);
			this.stopSyncAnimation();
			this.updateStatusBar('Sync failed');
			// Still show a notice for errors since they're important
			new Notice('Sync failed: ' + error.message);
		}
	}

	private async validateDriveFolder(accessToken: string): Promise<void> {
		const folderUrl = `https://www.googleapis.com/drive/v3/files/${this.settings.folderId}?fields=id,name,mimeType`;
		const response = await fetch(folderUrl, {
			headers: {
				'Authorization': `Bearer ${accessToken}`,
			},
		});

		if (!response.ok) {
			if (response.status === 404) {
				throw new Error('Google Drive folder not found. Please check your Folder ID in settings.');
			} else if (response.status === 403) {
				throw new Error('Access denied to Google Drive folder. Please check permissions.');
			} else {
				throw new Error(`Failed to access Google Drive folder: ${response.status} ${response.statusText}`);
			}
		}

		const folderData = await response.json();
		if (folderData.mimeType !== 'application/vnd.google-apps.folder') {
			throw new Error('The specified ID is not a Google Drive folder.');
		}

		console.log(`Validated Google Drive folder: ${folderData.name}`);
	}

	private async getDriveFiles(accessToken: string): Promise<any[]> {
		const listUrl = `https://www.googleapis.com/drive/v3/files?q='${this.settings.folderId}'%20in%20parents%20and%20trashed=false&fields=files(id,name,modifiedTime,size)`;
		const response = await fetch(listUrl, {
			headers: {
				'Authorization': `Bearer ${accessToken}`,
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to list files: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		return data.files || [];
	}

	private async uploadFile(drive: any, file: TFile, accessToken: string, fileId?: string) {
		console.log(`🔥 UPLOAD START: ${file.name}, size: ${file.stat.size}, binary: ${this.isBinaryFile(this.getMimeType(file.name))}`);
		this.logFileInfo(file.name);
		const mimeType = this.getMimeType(file.name);
		const isBinary = this.isBinaryFile(mimeType);

		let binaryContent: Buffer | null = null;
		let textContent: string | null = null;

		if (isBinary) {
			console.log(`Reading binary file ${file.name}, vault size: ${file.stat.size} bytes`);
			const arrayBuffer = await this.app.vault.readBinary(file);
			console.log(`ArrayBuffer length: ${arrayBuffer.byteLength} bytes`);
			binaryContent = Buffer.from(arrayBuffer);
			console.log(`Prepared binary content: ${binaryContent.length} bytes`);

			// Special debugging for PDFs
			if (file.name.toLowerCase().endsWith('.pdf')) {
				console.log(`PDF DEBUG: vault size=${file.stat.size}, arrayBuffer=${arrayBuffer.byteLength}, buffer=${binaryContent.length}`);
				if (binaryContent.length === 0) {
					console.error(`PDF ERROR: Buffer is empty for ${file.name}!`);
				}
			}
		} else {
			textContent = await this.app.vault.read(file);
			console.log(`Prepared text content: ${textContent.length} characters`);
		}

		try {
			console.log(`Got access token, uploading ${file.name}`);

			let result;

			if (fileId) {
				// Update existing file
				console.log(`Updating existing file ${file.name} (${fileId})`);
				const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
				const uploadResponse = await fetch(uploadUrl, {
					method: 'PATCH',
					headers: {
						'Authorization': `Bearer ${accessToken}`,
						'Content-Type': mimeType,
					},
					body: isBinary ? binaryContent! : textContent!,
				});

				if (!uploadResponse.ok) {
					throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
				}

					result = await uploadResponse.json();
					} else {
				// Create new file with multipart
				console.log(`Creating new file ${file.name}`);
				const boundary = 'boundary_' + Math.random().toString(36).substr(2);
				const metadata = {
					name: file.name,
					parents: [this.settings.folderId],
				};

				const metadataPart = '--' + boundary + '\r\n' +
					'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
					JSON.stringify(metadata) + '\r\n';
				const contentPartHeader = '--' + boundary + '\r\n' +
					'Content-Type: ' + mimeType + '\r\n\r\n';
				const endPart = '\r\n--' + boundary + '--';

				const metadataBuffer = Buffer.from(metadataPart, 'utf8');
				const headerBuffer = Buffer.from(contentPartHeader, 'utf8');
				const endBuffer = Buffer.from(endPart, 'utf8');
				const contentBuffer = isBinary ? binaryContent! : Buffer.from(textContent!, 'utf8');

				const body = Buffer.concat([metadataBuffer, headerBuffer, contentBuffer, endBuffer]);

				const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
				const uploadResponse = await fetch(uploadUrl, {
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${accessToken}`,
						'Content-Type': `multipart/related; boundary=${boundary}`,
					},
					body: body,
				});

				if (!uploadResponse.ok) {
					throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
				}

				result = await uploadResponse.json();
			}

			console.log(`Upload result:`, result);

			// Special debugging for PDFs - get actual file size from Drive
			if (file.name.toLowerCase().endsWith('.pdf')) {
				console.log(`PDF UPLOAD RESULT: size=${result?.size}, id=${result?.id}`);
			}
		} catch (uploadError) {
			console.error(`Upload failed for ${file.name}:`, uploadError);
			throw uploadError; // Re-throw to be caught by the sync method
		}
	}

	private async downloadFile(drive: any, driveFile: any, accessToken: string) {
		const mimeType = this.getMimeType(driveFile.name);
		const isBinary = this.isBinaryFile(mimeType);

		const downloadUrl = `https://www.googleapis.com/drive/v3/files/${driveFile.id}?alt=media`;
		const downloadResponse = await fetch(downloadUrl, {
			headers: {
				'Authorization': `Bearer ${accessToken}`,
			},
		});

		if (!downloadResponse.ok) {
			throw new Error(`Download failed: ${downloadResponse.status} ${downloadResponse.statusText}`);
		}

		let content: any;

		if (isBinary) {
			// For binary files, get the response as array buffer
			content = await downloadResponse.arrayBuffer();
		} else {
			// For text files, get as text
			content = await downloadResponse.text();
		}

		console.log(`Downloading file ${driveFile.name}, type: ${mimeType}, binary: ${isBinary}, size: ${driveFile.size} bytes`);

		if (isBinary) {
			// For binary files, content is already an ArrayBuffer
			console.log(`Content type: ArrayBuffer, length: ${content.byteLength}`);
			await this.app.vault.adapter.writeBinary(driveFile.name, content);

			// Special debugging for PDFs
			if (driveFile.name.toLowerCase().endsWith('.pdf')) {
				console.log(`PDF DOWNLOAD: drive size=${driveFile.size}, content length=${content.byteLength}`);
			}
		} else {
			// For text files, content is already a string
			console.log(`Content type: string, length: ${content.length}`);
			await this.app.vault.adapter.write(driveFile.name, content);
		}
	}

	private async handleConflict(drive: any, vaultFile: TFile, driveFile: any, accessToken: string) {
		switch (this.settings.conflictResolution) {
			case 'overwrite':
				// Upload vault version (overwrite Drive)
				await this.uploadFile(drive, vaultFile, driveFile.id);
				break;
			case 'keep-local':
				// Do nothing, keep vault version
				break;
			case 'keep-remote':
				// Download Drive version (overwrite vault)
				await this.downloadFile(drive, driveFile, accessToken);
				break;
			case 'ask':
				// Show user choice modal for conflict resolution
				this.showConflictModal(vaultFile.name, driveFile, async () => {
					// Keep local
					await this.uploadFile(drive, vaultFile, accessToken, driveFile.id);
					new Notice(`Kept local version of ${vaultFile.name}`);
				}, async () => {
					// Use remote
					await this.downloadFile(drive, driveFile, accessToken);
					new Notice(`Downloaded remote version of ${vaultFile.name}`);
				});
				break;
		}
	}

	private showConflictModal(fileName: string, driveFile: any, onKeepLocal: () => void, onUseRemote: () => void) {
		const modal = new ConflictModal(this.app, fileName, driveFile, onKeepLocal, onUseRemote);
		modal.open();
	}

	private getMimeType(filename: string): string {
		const ext = filename.split('.').pop()?.toLowerCase();
		switch (ext) {
			case 'md': return 'text/markdown';
			case 'txt': return 'text/plain';
			case 'json': return 'application/json';
			case 'png': return 'image/png';
			case 'jpg':
			case 'jpeg': return 'image/jpeg';
			case 'gif': return 'image/gif';
			case 'svg': return 'image/svg+xml';
			case 'pdf': return 'application/pdf';
			case 'dat': return 'application/octet-stream'; // Obsidian settings file
			default: return 'application/octet-stream';
		}
	}

	private logFileInfo(filename: string) {
		const ext = filename.split('.').pop()?.toLowerCase();
		const mimeType = this.getMimeType(filename);
		const isBinary = this.isBinaryFile(mimeType);
		console.log(`File ${filename}: ext=${ext}, mime=${mimeType}, binary=${isBinary}`);
	}

	private isBinaryFile(mimeType: string): boolean {
		// Text-based MIME types that should NOT be treated as binary
		const textTypes = [
			'text/',
			'application/json',
			'application/javascript',
			'application/xml',
			'application/x-yaml',
			'application/x-tex',
			'application/x-latex'
		];

		// If it starts with text/ or is a known text format, it's not binary
		return !textTypes.some(type => mimeType.startsWith(type));
	}

	private getAuthClient() {
		const oauth2Client = new google.auth.OAuth2(
			this.settings.clientId,
			this.settings.clientSecret,
			'urn:ietf:wg:oauth:2.0:oob'
		);
		oauth2Client.setCredentials({
			refresh_token: this.settings.refreshToken
		});
		return oauth2Client;
	}

	private async authenticate() {
		if (!this.settings.clientId || !this.settings.clientSecret) {
			new Notice('Please set Client ID and Client Secret in settings');
			return;
		}

		const oauth2Client = new google.auth.OAuth2(
			this.settings.clientId,
			this.settings.clientSecret,
			'urn:ietf:wg:oauth:2.0:oob'
		);

		const authUrl = oauth2Client.generateAuthUrl({
			access_type: 'offline',
			scope: ['https://www.googleapis.com/auth/drive.file']
		});

		// Open URL in browser
		window.open(authUrl);

		// Show modal to enter code
		new AuthModal(this.app, (code: string) => {
			oauth2Client.getToken(code, (err, token) => {
				if (err) {
					new Notice('Authentication failed: ' + err.message);
					return;
				}
				if (token && token.refresh_token) {
					this.settings.refreshToken = token.refresh_token;
					this.saveSettings();
					new Notice('Authenticated successfully!');
				} else {
					new Notice('Failed to get refresh token');
				}
			});
		}).open();
	}


}

class GoogleDriveSyncSettingTab extends PluginSettingTab {
	plugin: GoogleDriveSyncPlugin;

	constructor(app: App, plugin: GoogleDriveSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		containerEl.createEl('h2', {text: 'Google Drive Sync Settings'});

		new Setting(containerEl)
			.setName('Client ID')
			.setDesc('Your Google OAuth Client ID')
			.addText(text => text
				.setPlaceholder('Enter your Client ID')
				.setValue(this.plugin.settings.clientId)
				.onChange(async (value) => {
					this.plugin.settings.clientId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Client Secret')
			.setDesc('Your Google OAuth Client Secret')
			.addText(text => text
				.setPlaceholder('Enter your Client Secret')
				.setValue(this.plugin.settings.clientSecret)
				.onChange(async (value) => {
					this.plugin.settings.clientSecret = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Folder ID')
			.setDesc('ID of the Google Drive folder to sync with')
			.addText(text => text
				.setPlaceholder('Enter Folder ID')
				.setValue(this.plugin.settings.folderId)
				.onChange(async (value) => {
					this.plugin.settings.folderId = value;
					await this.plugin.saveSettings();
					this.plugin.setupAutoSync(); // Re-setup auto sync with new folder
				}));

		new Setting(containerEl)
			.setName('Sync Interval (minutes)')
			.setDesc('How often to sync automatically (0 to disable)')
			.addSlider(slider => slider
				.setLimits(5, 120, 5)
				.setValue(this.plugin.settings.syncInterval)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.syncInterval = value;
					await this.plugin.saveSettings();
					this.plugin.setupAutoSync();
				}));

		new Setting(containerEl)
			.setName('Auto Sync')
			.setDesc('Automatically sync on file changes and at intervals')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSync)
				.onChange(async (value) => {
					this.plugin.settings.autoSync = value;
					await this.plugin.saveSettings();
					this.plugin.setupAutoSync();
				}));

		new Setting(containerEl)
			.setName('Conflict Resolution')
			.setDesc('How to handle conflicts when files are modified in both places')
			.addDropdown(dropdown => dropdown
				.addOption('overwrite', 'Overwrite with local (recommended)')
				.addOption('keep-local', 'Keep local version')
				.addOption('keep-remote', 'Keep remote version')
				.addOption('ask', 'Ask each time')
				.setValue(this.plugin.settings.conflictResolution)
				.onChange(async (value: 'overwrite' | 'keep-local' | 'keep-remote' | 'ask') => {
					this.plugin.settings.conflictResolution = value;
					await this.plugin.saveSettings();
				}));
	}
}

class AuthModal extends Modal {
	callback: (code: string) => void;

	constructor(app: App, callback: (code: string) => void) {
		super(app);
		this.callback = callback;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: 'Enter Authorization Code' });
		contentEl.createEl('p', { text: 'Paste the code from the Google authorization page:' });

		const input = contentEl.createEl('input', { type: 'text' });
		input.style.width = '100%';

		const button = contentEl.createEl('button', { text: 'Submit' });
		button.onclick = () => {
			this.callback(input.value);
			this.close();
		};
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ConflictModal extends Modal {
	fileName: string;
	driveFile: any;
	onKeepLocal: () => void;
	onUseRemote: () => void;

	constructor(app: App, fileName: string, driveFile: any, onKeepLocal: () => void, onUseRemote: () => void) {
		super(app);
		this.fileName = fileName;
		this.driveFile = driveFile;
		this.onKeepLocal = onKeepLocal;
		this.onUseRemote = onUseRemote;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: '⚠ Sync Conflict Detected' });

		contentEl.createEl('p', {
			text: `The file \"${this.fileName}\" has been modified in both Obsidian and Google Drive since the last sync.`
		});

		const localTime = new Date().toLocaleString(); // This would be improved to show actual file modification time
		const remoteTime = new Date(this.driveFile.modifiedTime).toLocaleString();

		contentEl.createEl('p', { text: `Local version: Modified recently` });
		contentEl.createEl('p', { text: `Remote version: Modified ${remoteTime}` });

		contentEl.createEl('p', { text: 'Choose which version to keep:' });

		const buttonContainer = contentEl.createDiv({ cls: 'conflict-buttons' });

		const keepLocalBtn = buttonContainer.createEl('button', {
			text: 'Keep Local Version',
			cls: 'mod-cta'
		});
		keepLocalBtn.onclick = () => {
			this.onKeepLocal();
			this.close();
		};

		const useRemoteBtn = buttonContainer.createEl('button', {
			text: 'Use Remote Version',
			cls: 'mod-cta'
		});
		useRemoteBtn.onclick = () => {
			this.onUseRemote();
			this.close();
		};
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
