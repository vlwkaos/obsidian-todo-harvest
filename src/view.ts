import { ItemView, WorkspaceLeaf, setIcon, TFile, MarkdownView, MarkdownRenderer } from 'obsidian';
import { TODO_VIEW_TYPE, TodoItem } from './types';
import { scanFile, updateTodoLine } from './scanner';
import type TodoHarvestPlugin from './main';

export class TodoView extends ItemView {
	private plugin: TodoHarvestPlugin;
	private currentFile: TFile | null = null;
	private isUpdating = false; // suppress cache event when we initiated the change

	constructor(leaf: WorkspaceLeaf, plugin: TodoHarvestPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string { return TODO_VIEW_TYPE; }
	getDisplayText(): string { return 'Todo Harvest'; }
	getIcon(): string { return 'check-square'; }

	async onOpen(): Promise<void> {
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => this.onActiveLeafChange()),
		);
		this.registerEvent(
			this.app.metadataCache.on('changed', (file) => {
				if (!this.isUpdating && file === this.currentFile) this.refresh();
			}),
		);
		// Wait for layout before resolving initial file
		this.app.workspace.onLayoutReady(() => this.initCurrentFile());
	}

	private async initCurrentFile(): Promise<void> {
		// Prefer the active markdown view; fall back to first open markdown leaf
		const view = this.app.workspace.getActiveViewOfType(MarkdownView)
			?? (this.app.workspace.getLeavesOfType('markdown')[0]?.view as MarkdownView | undefined)
			?? null;
		const file = view?.file ?? null;
		if (file === this.currentFile) return;
		this.currentFile = file;
		await this.refresh();
	}

	private async onActiveLeafChange(): Promise<void> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return; // panel/sidebar got focus — keep showing current note
		const file = view.file ?? null;
		if (file === this.currentFile) return;
		this.currentFile = file;
		await this.refresh();
	}

	async refresh(): Promise<void> {
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.addClass('th-root');

		if (!this.currentFile) {
			root.createDiv({ cls: 'th-status', text: 'No note open.' });
			return;
		}

		const hdr = root.createDiv({ cls: 'th-header' });
		const fileLink = hdr.createEl('a', { cls: 'th-header-title', text: this.currentFile.basename });
		fileLink.addEventListener('click', () => this.openCurrentFile());

		let todos: TodoItem[];
		try {
			todos = await scanFile(this.app, this.currentFile);
		} catch (err) {
			root.createDiv({ cls: 'th-status', text: 'Scan failed — check console.' });
			console.error('[Todo Harvest]', err);
			return;
		}

		if (todos.length === 0) {
			root.createDiv({ cls: 'th-status', text: 'No todos in this note.' });
			return;
		}

		this.renderAll(root, todos);
	}

	private renderAll(root: HTMLElement, todos: TodoItem[]): void {
		const open = todos
			.filter(t => t.status === 'open')
			.sort((a, b) => {
				if (a.priority === null && b.priority === null) return 0;
				if (a.priority === null) return 1;
				if (b.priority === null) return -1;
				return a.priority - b.priority;
			});
		const finished = todos
			.filter(t => t.status !== 'open')
			.sort((a, b) => {
				// ! doneAt descending (recent first), nulls last
				if (a.doneAt && b.doneAt) return b.doneAt.localeCompare(a.doneAt);
				if (a.doneAt) return -1;
				if (b.doneAt) return 1;
				return 0;
			});

		this.renderGroup(root, `Open (${open.length})`, open, false);
		this.renderGroup(root, `Done (${finished.length})`, finished, false);
	}

	private renderGroup(root: HTMLElement, title: string, items: TodoItem[], collapsed: boolean): void {
		const section = root.createDiv({ cls: 'th-section' });
		const hdr = section.createDiv({ cls: 'th-section-hdr' });
		const arrow = hdr.createSpan({ cls: 'th-arrow', text: collapsed ? '▶' : '▼' });
		hdr.createSpan({ cls: 'th-section-label', text: title.toUpperCase() });

		const body = section.createDiv({ cls: 'th-section-body' });
		if (collapsed) body.style.display = 'none';

		hdr.addEventListener('click', () => {
			const hidden = body.style.display === 'none';
			body.style.display = hidden ? '' : 'none';
			arrow.setText(hidden ? '▼' : '▶');
		});

		if (items.length === 0) {
			body.createDiv({ cls: 'th-empty', text: '—' });
			return;
		}
		for (const item of items) {
			this.renderItem(body, item);
		}
	}

	private renderItem(parent: HTMLElement, item: TodoItem): void {
		const row = parent.createDiv({ cls: `th-item th-item-${item.status}` });

		const left = row.createDiv({ cls: 'th-item-check' });
		if (item.status === 'struck') {
			left.createSpan({ cls: 'th-struck-mark', text: 'S̶' });
		} else {
			const cb = left.createEl('input', { type: 'checkbox' });
			cb.checked = item.status === 'done';
			cb.addEventListener('change', async e => {
				e.stopPropagation();
				cb.disabled = true;
				await this.applyUpdate(item, cb.checked ? 'done' : 'open');
			});
		}

		if (item.priority !== null) {
			const label = item.priority === Number.MAX_SAFE_INTEGER ? '!p' : `!p${item.priority}`;
			row.createSpan({ cls: 'th-priority', text: label });
		}

		const mid = row.createDiv({ cls: 'th-item-body' });
		const textEl = mid.createDiv({ cls: 'th-item-text' });
		const renderTarget = item.status === 'struck' ? textEl.createEl('s') : textEl;
		MarkdownRenderer.render(this.app, item.content, renderTarget, item.filePath, this);
		// clicking bare text navigates to the line; actual link clicks pass through
		textEl.addEventListener('click', e => {
			if ((e.target as HTMLElement).closest('a')) return;
			e.stopPropagation();
			this.navigateLine(item);
		});

		if (item.doneAt) {
			mid.createSpan({ cls: 'th-doneat', text: item.doneAt });
		}

		if (item.tags.length > 0) {
			const tagRow = mid.createDiv({ cls: 'th-item-tags' });
			for (const tag of item.tags) {
				// use `a.tag.colored-tag-*` so colored-tags plugin CSS applies automatically
				const tagName = tag.replace(/^#/, '').toLowerCase();
				tagRow.createEl('a', { cls: `tag colored-tag-${tagName}`, text: tag });
			}
		}

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
				await this.applyUpdate(item, 'struck');
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
				await this.applyUpdate(item, 'open');
			});
		}
	}

	private async applyUpdate(item: TodoItem, newStatus: 'open' | 'done' | 'struck'): Promise<void> {
		this.isUpdating = true;
		try {
			await updateTodoLine(this.app, item, newStatus);
			await this.refresh();
		} finally {
			this.isUpdating = false;
		}
	}

	private async openCurrentFile(): Promise<void> {
		if (!this.currentFile) return;
		const leaf = this.app.workspace.getMostRecentLeaf();
		if (!leaf) return;
		await leaf.openFile(this.currentFile);
	}

	private async navigateLine(item: TodoItem): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(item.filePath);
		if (!(file instanceof TFile)) return;
		const leaf = this.app.workspace.getMostRecentLeaf();
		if (!leaf) return;
		await leaf.openFile(file);
		const view = leaf.view as any;
		if (!view?.editor) return;

		const { editor } = view;
		const pos = { line: item.lineNumber, ch: 0 };
		editor.setCursor(pos);
		editor.scrollIntoView({ from: pos, to: pos }, true);

		// Visual-only flash — wait for scroll + CM6 re-render to settle before animating
		setTimeout(() => {
			try {
				const cm = editor.cm;
				const lineInfo = cm.state.doc.line(item.lineNumber + 1); // CM6 is 1-indexed
				let el: Element | null = cm.domAtPos(lineInfo.from).node as Element;
				if (!(el instanceof Element)) el = (el as Node).parentElement;
				while (el && !el.classList.contains('cm-line')) el = el.parentElement;
				if (!el) return;
				el.classList.remove('th-line-flash');
				void (el as HTMLElement).offsetWidth; // force reflow to restart animation
				el.classList.add('th-line-flash');
				el.addEventListener('animationend', () => el?.classList.remove('th-line-flash'), { once: true });
			} catch { /* editor not ready */ }
		}, 200);
	}
}
