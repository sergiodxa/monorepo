---
title: Diff, show and review code
description: Compute line and word diffs and read or write git patches with @sdxc/diff, draw them unified or split with Diff, show a whole file with CodeView, and hang review threads off its lines, all working before any script loads.
section:
    title: Interface
    order: 4.5
order: 7
lastUpdated: 2026-11-13
outcomes:
    - "How to show a whole file with CodeView, cited lines read from ?L="
    - "How to turn a change into hunks with @sdxc/diff and draw it with Diff"
    - "How to comment on a line and answer in a ReviewThread"
---

A page about code shows one of two things: a file as it is, or a change to it. `@sdxc/ui/app`
draws both from plain data, and [`@sdxc/diff`](/api/diff) produces that data, so the server
renders every line, every link and every form, and two small islands add copying and line
selection on top.

```bash
npm add @sdxc/diff @sdxc/icons @sdxc/ui remix
```

The [Delta demo](/demo/apps/delta) is a code host built this way; open a file there to see
`CodeView` with blame.

## Register the islands

`CodeView` renders one island for its line menu and selection, and `Diff` one for the `+`
buttons, drag-to-select and copy buttons of every file it holds. Map both in the browser entry,
the way [Load content as readers reach it](/docs/building-remix-apps/load-content-as-readers-reach-it#register-the-client-entry)
maps a package island:

```typescript {% title="config/client-modules.ts" %}
export const PACKAGE_MODULES: Record<string, () => Promise<unknown>> = {
	"@sdxc/ui/app/code-view": () => import("@sdxc/ui/app/code-view"),
	"@sdxc/ui/app/diff": () => import("@sdxc/ui/app/diff"),
};
```

Until they load, and for a reader running no script, every line number is a link to its own
address and every `+` is a link to the comment form, so nothing on these pages waits on them.
`ReviewThread` needs no island: its forms post and reload the thread's own frame.

## Show a file

`CodeView` takes the file's text and its path. The lines a link cites travel in the address as
`?L=12-18`; read them with `parseLineRange` and the band over those lines is in the HTML the
server sends:

```tsx {% title="app/http/controllers/blob.tsx" %}
import { LinkButton } from "@sdxc/ui";
import { CodeView, codeStats, parseLineRange } from "@sdxc/ui/app/code-view";

let stats = codeStats(source);

<CodeView
	path="app/routes.ts"
	language="ts"
	code={source}
	selected={parseLineRange(ctx.url.searchParams.get("L"))}
	permalink={`/blob/${sha}/app/routes.ts`}
	labels={{
		lineMenu: "Line options",
		copyLine: "Copy line",
		copyPermalink: "Copy permalink",
		copied: "Copied",
	}}
>
	<CodeView.Header meta={`${stats.lines} lines (${stats.loc} loc)`}>
		<LinkButton href={`/raw/${sha}/app/routes.ts`} size="sm">
			Raw
		</LinkButton>
	</CodeView.Header>
</CodeView>;
```

With the island loaded, shift-click extends the selection, the line menu copies a line or a
permalink, and `y` swaps the address for the `permalink`. Pass `blame` hunks and each hunk
draws its commit and an age strip in a leading column; `CodeView.AgeLegend` in the header
explains the strip's colors.

## Diff two texts

`@sdxc/diff` computes and only computes: it takes strings and returns JSON-ready hunks, so the
same call runs in a build script, a Worker request or a test. A hunk holds lines, each
`context`, `add` or `del`, numbered on its sides, and a changed line pairs with the line it
replaced through `words`, the `[start, end)` spans that changed:

```typescript {% title="app/services/changes.ts" %}
import { diffLines } from "@sdxc/diff";

let diff = diffLines("let a = 1;\nlet b = 2;\n", "let a = 1;\nlet b = 3;\n");

diff.additions; // 1
diff.deletions; // 1
diff.hunks[0].lines;
// [
//   { kind: "context", text: "let a = 1;", old: 1, new: 1 },
//   { kind: "del", text: "let b = 2;", old: 2, words: [[8, 9]] },
//   { kind: "add", text: "let b = 3;", new: 2, words: [[8, 9]] },
// ]
```

Lines align the way `git diff --histogram` aligns them, on lines rare in the file such as a
function signature, so the hunks match what git would print. Use it when you hold both
versions yourself: a saved draft and the published post, or a suggestion and the lines it
replaces. `diffWords(oldLine, newLine)` gives the spans for one pair of lines on its own.

> [!NOTE]
> `diffLines` stops aligning after `maxCost` comparison steps (20 million by default) and
> answers the rest as one replaced block with `approximate: true`. The hunks still turn one
> text into the other, so a pathological input costs a coarser diff, never a timed-out request.

## Read a patch from git

When git made the change, read its patch. `parsePatch` lists every file in one pass, with its
paths, status, rename similarity and counts, and leaves the hunks as offsets into the text;
`parseHunks` reads one file's hunks when the page draws it:

```typescript {% title="app/services/commits.ts" %}
import { parseHunks, parsePatch } from "@sdxc/diff";

/** The output of `git show --format= -M --patch <sha>`. */
let files = parsePatch(patchText);
// [{ oldPath: "src/old.ts", newPath: "src/new.ts", status: "renamed", similarity: 94,
//    additions: 3, deletions: 1, binary: false, … }]

let hunks = parseHunks(patchText, files[0]!);
```

The [Delta demo](/demo/apps/delta) reads its own git history this way. A Worker has no git, so
its build runs `git show --format= -M --patch` for each commit and stores the text. On a
request the Worker parses a commit's files once, and a file's hunks only when a page asks for
that file, so a commit touching forty files costs one scan plus the files on screen.

## Write a patch back

`stringifyPatch` writes files and hunks as a git-style unified diff, for a "Download patch"
link or a suggestion a reader applies with `git apply`. What `parsePatch` and `parseHunks` read
comes back byte for byte:

```typescript {% title="app/http/controllers/pulls/patch.ts" %}
import { diffLines, stringifyPatch } from "@sdxc/diff";

let { hunks } = diffLines(original, suggested);
let patch = stringifyPatch([
	{
		oldPath: "notes.txt",
		newPath: "notes.txt",
		status: "modified",
		binary: false,
		hunks,
	},
]);

return new Response(patch, {
	headers: { "Content-Type": "text/x-diff; charset=utf-8" },
});
```

## Draw it

`Diff` wraps the page's files; `Diff.File` is one card. The unified or split choice is a query
parameter, so the toolbar's switch is two plain links and the server draws the view asked for:

```tsx {% title="app/http/controllers/pulls/files.tsx" %}
import { Diff } from "@sdxc/ui/app/diff";

let view = ctx.url.searchParams.get("diff") === "split" ? "split" : "unified";

<Diff labels={{ copied: "Copied" }}>
	<Diff.Toolbar
		view={view}
		unifiedHref="?diff=unified"
		splitHref="?diff=split"
		viewed={viewedCount}
		total={files.length}
		labels={toolbarLabels}
	/>
	{files.map((file) => (
		<Diff.File
			path={file.newPath}
			oldPath={file.oldPath}
			status={file.status}
			additions={file.additions}
			deletions={file.deletions}
			binary={file.binary}
			hunks={file.binary ? undefined : parseHunks(patchText, file)}
			language={languageOf(file.newPath)}
			view={view}
			labels={fileLabels}
		/>
	))}
</Diff>;
```

Each card collapses with a native `<details>`, and rows sit in chunks the browser skips laying
out until they near the screen, so a long change scrolls like a short one. For a file too large
to draw up front, pass `load`: the card renders closed with that content in place of its
lines, such as a `LazyFrame` that fetches the hunks when opened.

## Comment on a line

Give `Diff.File` a `commentHref` and every line draws a `+`. Without script it is a link, so
the server answers that address with the files page and the comment form open under the line:

```tsx {% title="app/http/controllers/pulls/files.tsx" %}
<Diff.File
	path="src/lexer/identifier.ts"
	status="modified"
	additions={9}
	deletions={3}
	hunks={hunks}
	view={view}
	commentHref={(path, side, line) =>
		`?comment=${encodeURIComponent(path)}:${side}${line}`
	}
	threads={{ R14: <ThreadFrame id="t-81" /> }}
	labels={fileLabels}
/>
```

With the island loaded, the `+` and a drag across line numbers dispatch `DIFF_COMMENT_EVENT`
on the document instead, carrying `path`, `side` (`"L"` old, `"R"` new) and the `start` and
`end` lines. The page's own island listens for it and opens its comment form there.

`threads` places existing conversations: each key is a side and a line, and its value draws as
a full-width row right after that line.

## Answer in a thread

`ReviewThread` is that row. Render it inside a named frame and point its forms at your
handlers; a reply, Resolve and Apply suggestion each post and reload only that frame:

```tsx {% title="resources/components/thread-frame.tsx" %}
import { diffLines } from "@sdxc/diff";
import { ReviewThread } from "@sdxc/ui/app/review-thread";

<ReviewThread
	id={`thread-${thread.id}`}
	frame={`thread-${thread.id}`}
	comments={thread.comments}
	resolved={thread.resolved}
	resolvedSummary={`${thread.resolvedBy} marked this conversation as resolved`}
	suggestion={{
		path: thread.path,
		language: "ts",
		hunks: diffLines(thread.original, thread.suggested).hunks,
		applyAction: `/threads/${thread.id}/apply`,
	}}
	replyAction={`/threads/${thread.id}/replies`}
	resolveAction={`/threads/${thread.id}/resolve`}
	fields={<input type="hidden" name="csrf" value={csrfToken} />}
	labels={threadLabels}
/>;
```

A resolved thread, or an `outdated` one whose lines have changed since, folds to one line
behind a `<details>`, so a long review keeps open only what still needs an answer. An outdated
thread passes `excerpt` to show the lines it was about, which the diff no longer draws.

## Test it

The hunks are plain data and the page is server HTML, so a test checks both without a browser:
that the diff found the change, and that a reader with no script still gets a link to comment:

```tsx {% title="app/services/changes.test.tsx" %}
import { diffLines } from "@sdxc/diff";
import { Diff } from "@sdxc/ui/app/diff";
import { renderToString } from "remix/component/server";
import { expect, test } from "vitest";

import { fileLabels } from "~/resources/components/diff-labels";

test("a one-word change pairs its lines and links each to a comment form", async () => {
	let { hunks, additions, deletions } = diffLines("let b = 2;\n", "let b = 3;\n");
	expect([additions, deletions]).toEqual([1, 1]);

	let html = await renderToString(
		<Diff.File
			path="a.ts"
			status="modified"
			additions={additions}
			deletions={deletions}
			hunks={hunks}
			commentHref={(path, side, line) => `?comment=${path}:${side}${line}`}
			labels={fileLabels}
		/>,
	);
	expect(html).toContain('href="?comment=a.ts:R1"');
});
```

## Where to go next

- [`Diff`](/api/ui/diff), [`ReviewThread`](/api/ui/review-thread) and
  [`CodeView`](/api/ui/code-view) — every prop, label and part, with live demos.
- [`@sdxc/diff`](/api/diff) — the diff options, `stringifyPatch` to write a patch back, and the
  types the hunks follow.
- [`CheckRuns`](/api/ui/check-runs) and [`MergeBox`](/api/ui/merge-box) — the rest of a pull
  request page, both plain forms and `<details>`.
