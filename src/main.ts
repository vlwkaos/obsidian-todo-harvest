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
	}

	onunload(): void {
		this.app.workspace.detachLeavesOfType(TODO_VIEW_TYPE);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		for (const leaf of this.app.workspace.getLeavesOfType(TODO_VIEW_TYPE)) {
			if (leaf.view instanceof TodoView) leaf.view.refresh();
		}
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
}
