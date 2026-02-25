import { Plugin, WorkspaceLeaf } from 'obsidian';
import { TodoView } from './view';
import { TODO_VIEW_TYPE, TodoHarvestSettings, DEFAULT_SETTINGS } from './types';
import { SettingsTab } from './settings';

export default class TodoHarvestPlugin extends Plugin {
	settings!: TodoHarvestSettings;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new SettingsTab(this.app, this));
		this.registerView(TODO_VIEW_TYPE, leaf => new TodoView(leaf, this));

		this.addRibbonIcon('check-square', 'Todo Harvest', () => this.activateView());
		this.addCommand({
			id: 'open-todo-harvest',
			name: 'Open sidebar',
			callback: () => this.activateView(),
		});

		// Debounce vault changes so rapid edits don't thrash the view
		let debounce: ReturnType<typeof setTimeout> | null = null;
		const scheduleRefresh = () => {
			if (debounce) clearTimeout(debounce);
			debounce = setTimeout(() => this.refreshViews(), 800);
		};
		this.registerEvent(this.app.vault.on('modify', scheduleRefresh));
		this.registerEvent(this.app.vault.on('create', scheduleRefresh));
		this.registerEvent(this.app.vault.on('delete', scheduleRefresh));
		this.registerEvent(this.app.vault.on('rename', scheduleRefresh));
	}

	async onunload(): Promise<void> {
		this.app.workspace.detachLeavesOfType(TODO_VIEW_TYPE);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.refreshViews();
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(TODO_VIEW_TYPE)[0] ?? null;
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			await leaf!.setViewState({ type: TODO_VIEW_TYPE, active: true });
		}
		workspace.revealLeaf(leaf!);
	}

	private refreshViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(TODO_VIEW_TYPE)) {
			if (leaf.view instanceof TodoView) leaf.view.refresh();
		}
	}
}
