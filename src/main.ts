import { Plugin } from 'obsidian';
import { SettingsManager } from './storage/settings';
import { TagMetaManager } from './storage/tagMeta';
import { TagPaneObserver } from './observers/tagPaneObserver';
import { TagCuratorSettingTab } from './ui/settingsTab';
import { TagListView, TAG_LIST_VIEW_TYPE } from './ui/tagListView';

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

		// Register views
		this.registerView(TAG_LIST_VIEW_TYPE, (leaf) => new TagListView(leaf, this));

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

		this.addCommand({
			id: 'open-tag-list',
			name: 'Open tag list view',
			callback: () => {
				this.activateView();
			}
		});

		console.log('Tag Curator plugin loaded successfully');
	}

	onunload() {
		console.log('Unloading Tag Curator plugin');
		this.tagPaneObserver.unload();
		this.tagMetaManager.unload();
	}

	private async activateView() {
		const { workspace } = this.app;

		let leaf = null;
		const leaves = workspace.getLeavesOfType(TAG_LIST_VIEW_TYPE);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			await leaf.setViewState({ type: TAG_LIST_VIEW_TYPE });
		}

		workspace.revealLeaf(leaf);
	}
}
