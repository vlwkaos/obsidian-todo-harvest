import { ItemView, WorkspaceLeaf, setIcon, TFile } from 'obsidian';
import { TODO_VIEW_TYPE, TodoItem } from './types';
import { scanVault, updateTodoLine } from './scanner';
import type TodoHarvestPlugin from './main';

interface FileGroup {
	filePath: string;
	fileName: string;
	fileMtime: number;
	items: TodoItem[];  // sorted by lineNumber
	hasOpen: boolean;
}

export class TodoView extends ItemView {
	private plugin: TodoHarvestPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: TodoHarvestPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string { return TODO_VIEW_TYPE; }
	getDisplayText(): string { return 'Todo Harvest'; }
	getIcon(): string { return 'check-square'; }

	async onOpen(): Promise<void> {
		await this.refresh();
	}

	async refresh(): Promise<void> {
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.addClass('th-root');

		const hdr = root.createDiv({ cls: 'th-header' });
		hdr.createSpan({ text: 'Todo Harvest', cls: 'th-header-title' });
		const refreshBtn = hdr.createEl('button', { cls: 'th-icon-btn', attr: { 'aria-label': 'Refresh' } });
		setIcon(refreshBtn, 'refresh-cw');
		refreshBtn.addEventListener('click', () => this.refresh());

		const scanning = root.createDiv({ cls: 'th-status', text: 'Scanning vault…' });
		let todos: TodoItem[];
		try {
			todos = await scanVault(this.app, this.plugin.settings);
		} catch (err) {
			scanning.setText('Scan failed — check console.');
			console.error('[Todo Harvest]', err);
			return;
		}
		scanning.remove();
		this.renderAll(root, todos);
	}

	private renderAll(root: HTMLElement, todos: TodoItem[]): void {
		const limit = this.plugin.settings.completedLimit;

		// Group todos by file
		const map = new Map<string, TodoItem[]>();
		for (const item of todos) {
			if (!map.has(item.filePath)) map.set(item.filePath, []);
			map.get(item.filePath)!.push(item);
		}

		// Build file groups, sort items within each file by line number
		const groups: FileGroup[] = [];
		for (const [filePath, items] of map) {
			items.sort((a, b) => a.lineNumber - b.lineNumber);
			const hasOpen = items.some(t => t.status === 'open');
			groups.push({
				filePath,
				fileName: items[0].fileName,
				fileMtime: items[0].fileMtime,
				items,
				hasOpen,
			});
		}

		// Files with open todos: sorted by recency, always shown
		const active = groups
			.filter(g => g.hasOpen)
			.sort((a, b) => b.fileMtime - a.fileMtime);

		// Files with only done/struck: sorted by recency, limited
		const doneOnly = groups
			.filter(g => !g.hasOpen)
			.sort((a, b) => b.fileMtime - a.fileMtime);

		const visibleDone = doneOnly.slice(0, limit);
		const archived = doneOnly.slice(limit);

		if (active.length === 0 && visibleDone.length === 0) {
			root.createDiv({ cls: 'th-status', text: 'No todos found.' });
			return;
		}

		for (const group of active) {
			this.renderFileGroup(root, group, false);
		}
		for (const group of visibleDone) {
			this.renderFileGroup(root, group, true);
		}

		if (archived.length > 0) {
			this.renderArchiveSection(root, archived);
		}
	}

	private renderFileGroup(root: HTMLElement, group: FileGroup, collapsed: boolean): void {
		const openCount = group.items.filter(t => t.status === 'open').length;

		const section = root.createDiv({ cls: 'th-file-section' });
		const hdr = section.createDiv({ cls: 'th-file-hdr' });

		const arrow = hdr.createSpan({ cls: 'th-arrow', text: collapsed ? '▶' : '▼' });

		const fileIcon = hdr.createSpan({ cls: 'th-file-icon' });
		setIcon(fileIcon, 'file-text');

		const nameLink = hdr.createEl('a', { cls: 'th-file-name', text: group.fileName });
		nameLink.addEventListener('click', e => {
			e.stopPropagation();
			this.openFile(group.filePath);
		});

		if (openCount > 0) {
			hdr.createSpan({ cls: 'th-file-count', text: String(openCount) });
		}

		const body = section.createDiv({ cls: 'th-file-body' });
		if (collapsed) body.style.display = 'none';

		hdr.addEventListener('click', () => {
			const hidden = body.style.display === 'none';
			body.style.display = hidden ? '' : 'none';
			arrow.setText(hidden ? '▼' : '▶');
		});

		for (const item of group.items) {
			this.renderItem(body, item);
		}
	}

	private renderArchiveSection(root: HTMLElement, groups: FileGroup[]): void {
		const section = root.createDiv({ cls: 'th-archive-section' });
		const hdr = section.createDiv({ cls: 'th-section-hdr' });
		const arrow = hdr.createSpan({ cls: 'th-arrow', text: '▶' });
		hdr.createSpan({ cls: 'th-section-label', text: `ARCHIVE (${groups.length} notes)` });

		const body = section.createDiv({ cls: 'th-section-body' });
		body.style.display = 'none';

		hdr.addEventListener('click', () => {
			const hidden = body.style.display === 'none';
			body.style.display = hidden ? '' : 'none';
			arrow.setText(hidden ? '▼' : '▶');
		});

		for (const group of groups) {
			this.renderFileGroup(body, group, true);
		}
	}

	private renderItem(parent: HTMLElement, item: TodoItem): void {
		const row = parent.createDiv({ cls: `th-item th-item-${item.status}` });

		// Left: checkbox or struck indicator
		const left = row.createDiv({ cls: 'th-item-check' });
		if (item.status === 'struck') {
			left.createSpan({ cls: 'th-struck-mark', text: 'S̶' });
		} else {
			const cb = left.createEl('input', { type: 'checkbox' });
			cb.checked = item.status === 'done';
			cb.addEventListener('change', async e => {
				e.stopPropagation();
				cb.disabled = true;
				await updateTodoLine(this.app, item, cb.checked ? 'done' : 'open');
			});
		}

		// Middle: text + tags
		const mid = row.createDiv({ cls: 'th-item-body' });
		const textEl = mid.createDiv({ cls: 'th-item-text' });
		if (item.status === 'struck') {
			textEl.createEl('s', { text: item.content });
		} else {
			textEl.setText(item.content);
		}

		if (item.tags.length > 0) {
			const tagRow = mid.createDiv({ cls: 'th-item-tags' });
			for (const tag of item.tags) {
				tagRow.createSpan({ cls: 'th-tag', text: tag });
			}
		}

		// Right: action buttons (visible on hover)
		const actions = row.createDiv({ cls: 'th-item-actions' });

		if (item.status === 'open') {
			const strikeBtn = actions.createEl('button', {
				cls: 'th-icon-btn',
				attr: { 'aria-label': 'Strike line' },
			});
			setIcon(strikeBtn, 'strikethrough');
			strikeBtn.addEventListener('click', async e => {
				e.stopPropagation();
				strikeBtn.disabled = true;
				await updateTodoLine(this.app, item, 'struck');
			});
		}

		if (item.status === 'struck') {
			const restoreBtn = actions.createEl('button', {
				cls: 'th-icon-btn',
				attr: { 'aria-label': 'Restore line' },
			});
			setIcon(restoreBtn, 'rotate-ccw');
			restoreBtn.addEventListener('click', async e => {
				e.stopPropagation();
				restoreBtn.disabled = true;
				await updateTodoLine(this.app, item, 'open');
			});
		}

		const navBtn = actions.createEl('button', {
			cls: 'th-icon-btn',
			attr: { 'aria-label': 'Go to line' },
		});
		setIcon(navBtn, 'arrow-right');
		navBtn.addEventListener('click', e => { e.stopPropagation(); this.navigateLine(item); });
	}

	private async openFile(filePath: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return;
		const leaf = this.app.workspace.getMostRecentLeaf();
		if (!leaf) return;
		await leaf.openFile(file);
	}

	private async navigateLine(item: TodoItem): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(item.filePath);
		if (!(file instanceof TFile)) return;
		const leaf = this.app.workspace.getMostRecentLeaf();
		if (!leaf) return;
		await leaf.openFile(file);
		const view = leaf.view as any;
		if (view?.editor) {
			const pos = { line: item.lineNumber, ch: 0 };
			view.editor.setCursor(pos);
			view.editor.scrollIntoView({ from: pos, to: pos }, true);
		}
	}
}
