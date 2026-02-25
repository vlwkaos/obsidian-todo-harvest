# Todo Harvest

Obsidian sidebar panel that collects all `[ ]` todos from your vault — built for journal-style note-taking where todos are scattered across daily notes.

## How it works

Open the sidebar via the ribbon icon or command palette → **Todo Harvest: Open sidebar**.

Todos are grouped by note, similar to the backlinks / outgoing links pane. Notes are sorted newest first.

- Notes with open todos are shown expanded
- Notes with only done / struck todos are shown collapsed (limited to N notes)
- Older done-only notes beyond the limit go into a collapsed **Archive** section

## Actions

**Checkbox** — tick or untick a todo. Updates the original file immediately.

**Strikethrough button** (on open items) — strikes the whole line (`- ~~text~~`). Use this to dismiss a todo without marking it done. Appears on hover.

**Restore button** (on struck items) — removes the strikethrough, restores the line as open.

**Arrow button** — opens the source note and scrolls to that line.

## Settings

| Setting | Default | Description |
|---|---|---|
| Completed notes limit | `10` | Max notes with only done/struck todos shown before archiving |
| Exclude folders | `templates` | Comma-separated folders to skip when scanning |

## Todo format

The plugin reads standard markdown checkboxes:

```
- [ ] open todo
- [x] completed todo
- [ ] tagged todo #project #work
```

Struck items are stored as:

```
- ~~original line~~
```

Tags (`#tag`) found in the todo text are shown as chips in the panel.

## Development

```bash
cd obsidian-todo-harvest
npm install
npm run dev          # watch mode
npm run setup -- dgv3  # build + link to vault named "dgv3"
```
