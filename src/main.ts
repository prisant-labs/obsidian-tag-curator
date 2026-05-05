import { App, Plugin } from 'obsidian';
import { SettingsManager } from './storage/settings';
import { TagMetaManager } from './storage/tagMeta';
import { TagPaneObserver } from './observers/tagPaneObserver';
import { TagCuratorSettingTab } from './ui/settingsTab';

export default class TagCuratorPlugin extends Plugin {
	settingsManager: SettingsManager;
	tagMetaManager: TagMetaManager;
	tagPaneObserver: TagPaneObserver;

	async onload() {
		console.log('Loading Tag Curator plugin');

		// Initialize managers
		this.settingsManager = new SettingsManager(this);
		this.tagMetaManager = new TagMetaManager(this.app, this);
		this.tagPaneObserver = new TagPaneObserver(this.app, this);

		// Load settings
		await this.settingsManager.load();
		await this.tagMetaManager.init();

		// Initialize observers
		this.tagPaneObserver.init();

		// Update UI when settings change
		this.settingsManager.onChanged(() => {
			const rules = this.settingsManager.getActiveRules();
			this.tagPaneObserver.updateRules(rules);
		});

		// Update filters when metadata changes
		this.tagMetaManager.onChanged(() => {
			const metadata = this.tagMetaManager.getAllTagMeta();
			this.tagPaneObserver.updateTagMetadata(metadata);
		});

		// Add settings tab
		this.addSettingTab(new TagCuratorSettingTab(this.app, this));

		// Add status bar item
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Tag Curator: Ready');

		// Add commands
		this.addCommand({
			id: 'toggle-tag-curator',
			name: 'Toggle Tag Curator on/off',
			callback: () => {
				const settings = this.settingsManager.getSettings();
				// For now, just log - full implementation in future versions
				console.log('Tag Curator toggled');
			}
		});

		this.addCommand({
			id: 'reload-presets',
			name: 'Reload preset rules',
			callback: async () => {
				// Reapply all rules
				const rules = this.settingsManager.getActiveRules();
				this.tagPaneObserver.updateRules(rules);
			}
		});

		console.log('Tag Curator plugin loaded successfully');
	}

	onunload() {
		console.log('Unloading Tag Curator plugin');
		this.tagPaneObserver.unload();
		this.tagMetaManager.unload();
	}
}
