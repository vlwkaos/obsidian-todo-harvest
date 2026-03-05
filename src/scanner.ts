import { App, TFile } from 'obsidian';
import { TodoItem } from './types';

// - [ ] content...
const OPEN_RE = /^(\s*[-*+] \[ \] )(.+)$/;
// - [x] content...
const DONE_RE = /^(\s*[-*+] \[x\] )(.+)$/i;
// - ~~content~~ (struck by this plugin)
const STRUCK_RE = /^(\s*[-*+] )~~(.+)~~\s*$/;
const TAG_RE = /#[\w/-]+/g;
// !p or !p1 !p2 etc. — !p(\d*) not followed by another word char to avoid false matches
const PRIORITY_RE = /!p(\d*)(?!\w)/;
const DONEAT_RE = /!doneat-(\d{4}-\d{2}-\d{2})(?!\w)/;

function parsePriority(content: string): { content: string; priority: number | null } {
	const m = PRIORITY_RE.exec(content);
	if (!m) return { content, priority: null };
	const priority = m[1] ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER; // bare !p sorts after !p1, !p2...
	return { content: content.replace(m[0], '').trim(), priority };
}

function parseDoneAt(content: string): { content: string; doneAt: string | null } {
	const m = DONEAT_RE.exec(content);
	if (!m) return { content, doneAt: null };
	return { content: content.replace(m[0], '').trim(), doneAt: m[1] };
}

function parseLine(line: string): { status: 'open' | 'done' | 'struck'; content: string; priority: number | null; doneAt: string | null } | null {
	let m = STRUCK_RE.exec(line);
	if (m) {
		const raw = m[2].trim().replace(/^\[[ xX]\] /, '');
		const { content, doneAt } = parseDoneAt(raw);
		return { status: 'struck', content, priority: null, doneAt };
	}
	m = DONE_RE.exec(line);
	if (m) {
		const { content: c1, doneAt } = parseDoneAt(m[2].trim());
		const { content, priority } = parsePriority(c1);
		return { status: 'done', content, priority, doneAt };
	}
	m = OPEN_RE.exec(line);
	if (m) {
		const { content, priority } = parsePriority(m[2].trim());
		return { status: 'open', content, priority, doneAt: null };
	}
	return null;
}

export async function scanFile(app: App, file: TFile): Promise<TodoItem[]> {
	const text = await app.vault.cachedRead(file);
	const lines = text.split('\n');
	const todos: TodoItem[] = [];

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
			priority: parsed.priority,
			doneAt: parsed.doneAt,
			fileMtime: file.stat.mtime,
		});
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

	const idx = lines[item.lineNumber] === item.rawLine
		? item.lineNumber
		: lines.indexOf(item.rawLine);
	if (idx === -1) return;

	const line = lines[idx];
	let newLine: string;
	const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

	if (newStatus === 'done') {
		newLine = line.replace(/\[ \]/, '[x]');
		// ! append !doneat only if not already present
		if (!DONEAT_RE.test(newLine)) newLine = newLine.trimEnd() + ` !doneat-${today}`;
	} else if (newStatus === 'open') {
		if (item.status === 'done') {
			newLine = line.replace(/\[x\]/i, '[ ]');
		} else if (item.status === 'struck') {
			newLine = line.replace(/^(\s*[-*+] )~~(.+)~~\s*$/, '$1$2');
		} else {
			newLine = line;
		}
		// ! strip !doneat when reopening
		newLine = newLine.replace(/\s*!doneat-\d{4}-\d{2}-\d{2}/, '');
	} else {
		const m = /^(\s*[-*+] )(.+)$/.exec(line);
		if (m) {
			// ! doneat goes inside ~~ so parseLine can extract it
			const inner = DONEAT_RE.test(m[2]) ? m[2] : `${m[2].trimEnd()} !doneat-${today}`;
			newLine = `${m[1]}~~${inner}~~`;
		} else {
			newLine = line;
		}
	}

	lines[idx] = newLine;
	await app.vault.modify(file, lines.join('\n'));
}
