# @sdxc/diff

Line and word diffs with git's histogram alignment, and unified diffs parsed and written as plain data.

Everything here is computing, not rendering: functions take strings and return JSON-serializable
hunks, so the same code runs in a build script, a Worker request or a test, and a renderer of
your choice draws the result.

## Installation

```sh
npm add @sdxc/diff
```

## Usage

### Diff two texts

```typescript
import { diffLines } from "@sdxc/diff";

let diff = diffLines("let a = 1;\nlet b = 2;\n", "let a = 1;\nlet b = 3;\n");
// {
//   hunks: [{
//     oldStart: 1, oldLines: 2, newStart: 1, newLines: 2,
//     lines: [
//       { kind: "context", text: "let a = 1;", old: 1, new: 1 },
//       { kind: "del", text: "let b = 2;", old: 2, words: [[8, 9]] },
//       { kind: "add", text: "let b = 3;", new: 2, words: [[8, 9]] },
//     ],
//   }],
//   additions: 1,
//   deletions: 1,
//   approximate: false,
// }
```

Lines align the way `git diff --histogram` aligns them: on lines that are rare in the file,
such as a function signature, rather than on braces and blank lines. The output matches git's,
hunk for hunk, including the section heading after `@@` and where an ambiguous block of
changes is placed.

`words` holds the changed spans of a deleted line and the added line it pairs with, as
`[start, end)` offsets into `text`.

### Read a patch from git

```typescript
import { parseHunks, parsePatch } from "@sdxc/diff";

let text = await gitShow(sha); // the output of `git show --format= -M --patch <sha>`
let files = parsePatch(text);
// [{ oldPath: "src/old.ts", newPath: "src/new.ts", status: "renamed", similarity: 94,
//    additions: 3, deletions: 1, binary: false, … }]

let hunks = parseHunks(text, files[0]);
```

`parsePatch` reads every file's header in one pass and leaves the hunks as offsets into the
text, so listing the files of a large commit costs one scan. Call `parseHunks` for the files you
show.

### Write a patch

```typescript
import { diffLines, stringifyPatch } from "@sdxc/diff";

let { hunks } = diffLines(before, after);
let patch = stringifyPatch([
	{ oldPath: "notes.txt", newPath: "notes.txt", status: "modified", binary: false, hunks },
]);
// diff --git a/notes.txt b/notes.txt
// --- a/notes.txt
// +++ b/notes.txt
// @@ -1,2 +1,2 @@
// …
```

What `parsePatch` and `parseHunks` read from git comes back byte for byte.

## API

### `diffLines(oldText: string, newText: string, options?: DiffOptions): LineDiff`

Diffs two texts line by line into hunks with context. Lines end at `\n`; a `\r` stays part of
the line, and a side that ends without a newline marks its last line `noNewline`.

- `options.algorithm`: `"histogram"` (default) or `"myers"`, a minimal edit script.
- `options.context`: unchanged lines around each change (default `3`); changes up to twice
  this far apart share a hunk.
- `options.words`: compute word ranges for paired lines (default `true`).
- `options.maxCost`: comparison steps the alignment may spend (default `20_000_000`). Past it,
  the rest of the input becomes one replace block and the result has `approximate: true`, so
  pathological input degrades the diff, never the request. The hunks still turn `oldText` into
  `newText`.

### `diffWords(oldLine: string, newLine: string): WordDiff | undefined`

Diffs two paired lines by tokens: identifiers and numbers, whitespace runs, and single
punctuation characters. Answers `{ old, new }` ranges, or `undefined` when either line is over
1,000 characters or the two share less than half their tokens, where marking spans would not
help a reader and the whole line is the change.

### `parsePatch(text: string): FilePatch[]`

Reads every file of a unified diff: paths, status, modes, blob ids, similarity, whether it is
binary, and its counts of added and deleted lines. Text before the first file, such as a
commit message, is skipped. Paths are unquoted and lose their `a/` and `b/` prefixes.

### `parseHunks(text: string, file: FilePatch, options?: ParseHunksOptions): Hunk[]`

Reads the hunks of one file `parsePatch` returned for the same `text`, numbering each line on
its sides. `options.words` (default `true`) adds word ranges to paired lines.

### `stringifyPatch(entries: PatchEntry[]): string`

Writes files and hunks as a git-style unified diff. A binary entry gets git's
`Binary files … differ` line; an entry without hunks gets its headers only.

### Types

#### `Line`

`{ kind: "context" | "add" | "del", text, old?, new?, words?, noNewline? }`. `old` and `new` are
1-based line numbers on the sides the line belongs to.

#### `Hunk`

`{ oldStart, oldLines, newStart, newLines, section?, lines }`, numbered as in a `@@` header.

#### `FileHeader`, `FilePatch` and `PatchEntry`

`FileHeader` is `{ oldPath, newPath, status, binary, oldMode?, newMode?, oldHash?, newHash?,
similarity?, dissimilarity? }`, with `status` one of `"added"`, `"modified"`, `"deleted"`,
`"renamed"` or `"copied"`. `FilePatch` adds `additions`, `deletions` and the `bodyStart` /
`bodyEnd` offsets of its hunks; `PatchEntry` adds `hunks`.

#### `LineDiff` and `WordDiff`

`LineDiff` is `{ hunks, additions, deletions, approximate }`. `WordDiff` is
`{ old: WordRange[], new: WordRange[] }`, each range a `[start, end]` pair.

## Patterns

### Render a commit's files, parsing only what the page shows

```typescript
import { parseHunks, parsePatch } from "@sdxc/diff";

const LOAD_DIFF_THRESHOLD = 400;

export function filesOf(patch: string) {
	return parsePatch(patch).map((file) => ({
		path: file.newPath,
		status: file.status,
		additions: file.additions,
		deletions: file.deletions,
		hunks:
			file.binary || file.additions + file.deletions > LOAD_DIFF_THRESHOLD
				? undefined
				: parseHunks(patch, file),
	}));
}
```

Large files keep their counts for the file list and load their hunks on demand.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/diff": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
