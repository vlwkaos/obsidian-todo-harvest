import { App, PluginSettingTab, Setting } from 'obsidian';
import type TodoHarvestPlugin from './main';

export class SettingsTab extends PluginSettingTab {
	constructor(app: App, private plugin: TodoHarvestPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Todo Harvest' });

		new Setting(containerEl)
			.setName('Completed notes limit')
			.setDesc('Max notes with only done / struck todos shown. Excess moves to the Archive section.')
			.addText(text =>
				text
					.setPlaceholder('10')
					.setValue(String(this.plugin.settings.completedLimit))
					.onChange(async value => {
						const n = parseInt(value, 10);
						if (!isNaN(n) && n >= 1) {
							this.plugin.settings.completedLimit = n;
							await this.plugin.saveSettings();
						}
					}),
			);

		new Setting(containerEl)
			.setName('Exclude folders')
			.setDesc('Comma-separated folder names to skip when scanning (e.g. templates, archive).')
			.addText(text =>
				text
					.setPlaceholder('templates')
					.setValue(this.plugin.settings.excludeFolders)
					.onChange(async value => {
						this.plugin.settings.excludeFolders = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
