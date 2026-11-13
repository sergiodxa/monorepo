---
title: Show and review code
description: Render a source file with line links and blame, compute or read a diff with @sdxc/diff, draw it unified or split, and hang review threads off its lines, all working before any script loads.
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

## Compute the change

A diff is hunks of lines, each `context`, `add` or `del`, with its line numbers and the words
that changed. Get them one of two ways:

```typescript {% title="app/services/changes.ts" %}
import { diffLines, parseHunks, parsePatch } from "@sdxc/diff";

/** Two versions you hold yourself, such as a saved draft and the published text. */
let { hunks, additions, deletions } = diffLines(before, after);

/** A patch from git: list every file in one pass, then read the hunks of those you show. */
let files = parsePatch(patchText);
let first = parseHunks(patchText, files[0]!);
```

`parsePatch` leaves each file's hunks as offsets into the text, so a commit touching three
hundred files costs one scan, and the page reads hunks only for the files it draws.

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

## Where to go next

- [`Diff`](/api/ui/diff), [`ReviewThread`](/api/ui/review-thread) and
  [`CodeView`](/api/ui/code-view) — every prop, label and part, with live demos.
- [`@sdxc/diff`](/api/diff) — the diff options, `stringifyPatch` to write a patch back, and the
  types the hunks follow.
- [`CheckRuns`](/api/ui/check-runs) and [`MergeBox`](/api/ui/merge-box) — the rest of a pull
  request page, both plain forms and `<details>`.
