# Vendored third-party files

Everything under `docs/vendor` is third-party text, copied in as published so a
check can run against the document it was written for. Nothing here is edited:
a correction goes upstream, and the copy is replaced from the source below.

## `commonmark/spec.json`

The example set of the [CommonMark Specification](https://spec.commonmark.org/),
version **0.31.2**, taken from `https://spec.commonmark.org/0.31.2/spec.json`.

652 examples, each `{ markdown, html, example, start_line, end_line, section }`,
where `start_line` and `end_line` index the specification's own `spec.txt`.

`packages/markdown/src/conformance/spec.test.ts` runs every one of them.

## `gfm/spec.txt` and `gfm/spec.json`

The [GitHub Flavored Markdown Specification](https://github.github.com/gfm/),
version **0.29** (2019-04-06), taken from
`https://github.github.com/gfm/`. `spec.txt` is the specification as published,
prose and examples together.

`spec.json` is derived from it, and holds the six fields the CommonMark example
set does plus one more:

- Each example is the text between a line of thirty-two backticks followed by
  ` example` and the closing line of thirty-two backticks, split at the line
  holding a single `.` into the source and the expected HTML.
- Every `→` is restored to the tab character it stands for in the prose.
- `section` is the nearest ATX heading above the example.
- `example` numbers the extracted examples from one, and `start_line` /
  `end_line` index `spec.txt`.
- `extension` carries the word the specification writes after ` example` on the
  examples belonging to one of its extensions: `table`, `disabled` for task
  lists, `strikethrough`, `autolink`, and `tagfilter`.

That is **672** examples, the extension ones included, so the suite exercises
tables, task lists, strikethrough, and literal autolinks against the
specification rather than against unit tests alone.

`packages/markdown/src/conformance/spec.test.ts` runs every one of them. The
single `tagfilter` example is expected to differ: `@sdxc/markdown` renders raw
HTML as escaped text, which is a stronger guarantee than the filter the
extension describes, so nothing raw ever becomes markup for it to filter.

## `@remix-run/*` and `remix/`

The `README.md` of each Remix v3 package, at the `3.0.0-rc.2` release the
workspaces pin, so a reader finds the API a package actually ships without
reaching into `node_modules`. Refresh them whenever the pin moves.
