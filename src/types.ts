export const TODO_VIEW_TYPE = 'todo-harvest-view';

export interface TodoItem {
	id: string;          // `${filePath}::${lineNumber}`
	filePath: string;
	fileName: string;
	lineNumber: number;
	rawLine: string;     // original line text (for reliable update)
	content: string;     // parsed todo text (no markers, no priority suffix)
	tags: string[];
	status: 'open' | 'done' | 'struck';
	priority: number | null; // null = none, MAX_SAFE_INTEGER = bare !, N = !N
	fileMtime: number;   // ms — used for recency sort
}

export interface TodoHarvestSettings {
	completedLimit: number;
	excludeFolders: string;  // comma-separated
}

export const DEFAULT_SETTINGS: TodoHarvestSettings = {
	completedLimit: 10,
	excludeFolders: 'templates',
};
