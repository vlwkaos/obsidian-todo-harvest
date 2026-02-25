import { App, TFile } from 'obsidian';
import { TodoItem, TodoHarvestSettings } from './types';

// - [ ] content...
const OPEN_RE = /^(\s*[-*+] \[ \] )(.+)$/;
// - [x] content...
const DONE_RE = /^(\s*[-*+] \[x\] )(.+)$/i;
// - ~~content~~ (struck by this plugin)
const STRUCK_RE = /^(\s*[-*+] )~~(.+)~~\s*$/;
const TAG_RE = /#[\w/-]+/g;

interface ParsedLine {
	status: 'open' | 'done' | 'struck';
	content: string;
}

function parseLine(line: string): ParsedLine | null {
	// Check struck first — avoids false-match on "- ~~[ ] foo~~" as open
	let m = STRUCK_RE.exec(line);
	if (m) {
		// Strip checkbox marker if the struck line was a todo
		const content = m[2].trim().replace(/^\[[ xX]\] /, '');
		return { status: 'struck', content };
	}
	m = DONE_RE.exec(line);
	if (m) return { status: 'done', content: m[2].trim() };
	m = OPEN_RE.exec(line);
	if (m) return { status: 'open', content: m[2].trim() };
	return null;
}

export async function scanVault(app: App, settings: TodoHarvestSettings): Promise<TodoItem[]> {
	const excluded = settings.excludeFolders
		.split(',')
		.map(s => s.trim())
		.filter(Boolean);

	const todos: TodoItem[] = [];
	for (const file of app.vault.getMarkdownFiles()) {
		if (excluded.some(f => file.path.startsWith(f + '/'))) continue;

		let text: string;
		try {
			text = await app.vault.cachedRead(file);
		} catch {
			continue;
		}

		const lines = text.split('\n');
		for (let i = 0; i < lines.length; i++) {
			const parsed = parseLine(lines[i]);
			if (!parsed) continue;
			todos.push({
				id: `${file.path}::${i}`,
				filePath: file.path,
				fileName: file.basename,
				lineNumber: i,
				rawLine: lines[i],
				content: parsed.content,
				tags: parsed.content.match(TAG_RE) ?? [],
				status: parsed.status,
				fileMtime: file.stat.mtime,
			});
		}
	}
	return todos;
}

export async function updateTodoLine(
	app: App,
	item: TodoItem,
	newStatus: 'open' | 'done' | 'struck',
): Promise<void> {
	const file = app.vault.getAbstractFileByPath(item.filePath);
	if (!(file instanceof TFile)) return;

	const text = await app.vault.read(file);
	const lines = text.split('\n');

	// Try stored line number first, fall back to full search
	let idx = lines[item.lineNumber] === item.rawLine ? item.lineNumber : lines.indexOf(item.rawLine);
	if (idx === -1) return;

	const line = lines[idx];
	let newLine: string;

	if (newStatus === 'done') {
		newLine = line.replace(/\[ \]/, '[x]');
	} else if (newStatus === 'open') {
		if (item.status === 'done') {
			newLine = line.replace(/\[x\]/i, '[ ]');
		} else if (item.status === 'struck') {
			// Remove ~~...~~ wrapper, keep the inner content
			newLine = line.replace(/^(\s*[-*+] )~~(.+)~~\s*$/, '$1$2');
		} else {
			newLine = line;
		}
	} else { // struck
		const m = /^(\s*[-*+] )(.+)$/.exec(line);
		newLine = m ? `${m[1]}~~${m[2]}~~` : line;
	}

	lines[idx] = newLine;
	await app.vault.modify(file, lines.join('\n'));
}
