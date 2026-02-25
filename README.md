# Todo Harvest

Note-context aware todo panel for Obsidian. Shows todos from the currently open note — updates automatically as you switch notes, like the backlinks pane.

Built for journal-style note-taking where todos accumulate inline and you don't want to manage them separately.

## How it works

Open via the ribbon icon or **Todo Harvest: Open sidebar** command.

The panel tracks the active note and displays its todos in three groups:

- **Open** — unchecked todos in file order
- **Done / Struck** — last N completed/struck items
- **Archive** — older done/struck items beyond the limit, collapsed

The panel syncs bidirectionally: tick in the panel → updates the file, tick in the editor → updates the panel.

## Actions

**Checkbox** — toggle `[ ]` / `[x]` directly in the source file.

**Click todo text** — open the note and scroll to that line.

**Strikethrough button** (hover, open items) — strikes the whole line as `- ~~text~~`. Use to dismiss without completing.

**Restore button** (hover, struck items) — removes the strikethrough, restores as open.

## Tags

Tags (`#tag`) in todo text are shown as colored pills using the [colored-tags](https://github.com/pfayoux/obsidian-colored-tags) plugin palette if installed.

## Settings

| Setting | Default | Description |
|---|---|---|
| Completed item limit | `10` | Max done/struck items shown before archiving |
| Exclude folders | `templates` | Comma-separated folder names to skip |

## Todo format

```
- [ ] open todo
- [x] completed todo
- [ ] buy groceries #shopping #errand
```

Struck items (stored in file as):

```
- ~~original line~~
```

## Development

```bash
cd obsidian-todo-harvest
npm install
npm run dev              # watch mode
npm run setup -- dgv3   # build + link to vault
```
