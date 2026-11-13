# ADR-005: Delta Reads Its Own Git History at Build Time

## Status

**Implemented** - 2026-11-13

## Background

Delta, the seventh demo app on sdxc.dev (`/demo/apps/delta`), is a code host whose one
repository, `sdxc/delta`, is Delta's own source. Its file view, blame, commits list and commit
diffs show real files and real history, so the demo proves `CodeView`, `Tree`, `FilterMenu` and
the later `Diff` against data nobody hand-tuned.

The site runs as a Cloudflare Worker. A Worker has no filesystem and no git, so every file and
commit Delta shows has to be inside the deploy. The research behind the app
(`docs/research/github-demo.md`, §4.2) settled where that data comes from; this record keeps the
decision and its limits.

## Context

### What the screens need

| Screen                  | Reads                                                         |
| ----------------------- | ------------------------------------------------------------- |
| Repository home, folder | Every file, and the newest commit touching each file/folder   |
| File view               | The file's text, tokenized; blame ranges with commit metadata |
| Go to file              | Every path                                                    |
| Commits                 | The latest commits: author names, dates, subjects, bodies     |
| Commit (diff, later)    | Each commit's unified diff limited to Delta's files           |
| Seeded issues, threads  | Line ranges that follow their code from commit to commit      |

### Constraints

- **No module-scope work in the Worker.** A module-scope Markdown parse once failed the
  Worker upload, so nothing is parsed, tokenized or diffed when a module loads.
- **Only Delta's folder is browsable.** `@sdxc/ui` and every dependency stay out (decision D3
  of the research).
- **No emails.** Authors are shown by name, and `Co-Authored-By` trailers become a co-author
  row of names (D10).
- **History grows with every commit**, so nothing may assume a fixed count or latest sha.
- **Precedent:** `scripts/extract-catalogue.ts` already runs before `dev`, `build` and the
  test run, writing gitignored JSON that `app/services/components.ts` loads through a lazy
  `import.meta.glob`.

## Decision

`apps/sdxc-site/scripts/extract-delta.ts` runs beside `extract-catalogue.ts` in `dev`, `build`
and the Vitest global setup (`scripts/catalogue.setup.ts`, now used by the browser project
too). It pins `git rev-parse HEAD` and reads only
`apps/sdxc-site/resources/views/demo-apps/delta/` at that commit, never the working tree:

1. **Files:** `git ls-tree` and `git show HEAD:<path>`, stored as `{ path, text, bytes, lines }`
   with paths relative to Delta's folder, plus the newest commit touching each file and folder
   (`git log -1`).
2. **History:** `git log -n 200 --no-merges` with names, ISO dates, subjects and full bodies.
   Every trailer carrying an email is removed from the body; `Co-Authored-By` names are kept.
3. **Patches:** `git show --format= --no-color -M --histogram --patch <sha> -- <delta>` per
   commit, header paths made relative, kept raw for request-time parsing with `@sdxc/diff`. A
   single file's patch over 64 KB is dropped and listed, for "Large diff not shown".
4. **Blame:** `git blame --porcelain` per file, compacted to `{ start, end, sha }` runs. A
   commit blame names outside the 200-commit cap keeps a metadata-only entry.
5. **Anchors:** seeded citations (`delta/anchors.ts`) written as `{ path, match, span }`,
   resolved to line ranges; one that no longer matches is marked outdated with its excerpt
   from the commit it names.
6. **Budget:** the documents together must stay under 2 MB raw, or the script exits non-zero.
7. **Shallow clones:** the files are still written, and the history is empty and flagged
   `shallow`, so the commits screen shows a typed empty state rather than failing the build.

The output is `resources/generated/delta/{tree,history,patches,blame,anchors}.json`,
gitignored with the rest of `resources/generated`. Patches get their own document so the
commits list never loads them.

`app/services/delta/source.ts` loads each document through a lazy `import.meta.glob` on the
first request that needs it and memoizes, per isolate, tokenizing a file (`tokenizeLines`,
keyed by path and sha) and parsing a commit's patch (headers per sha, hunks per path and sha).
The limits live in `config/delta.ts`, shared by the script and the screens that report them.

## Consequences

### Positive

- Every file, blame line and commit Delta shows is real, and the demo stays a static deploy.
- Each deploy shows exactly the history up to the commit it was built from; nothing in source
  has to describe itself, since the generated JSON is never committed.
- The build fails loudly when the data outgrows its budget instead of quietly growing the
  Worker.

### Negative

- About a megabyte of JSON rides in the Worker bundle once the history fills up. If the budget
  is ever breached, the fallback is to write the documents into the static assets and read
  them through the `ASSETS` binding.
- Uncommitted edits to Delta never appear in `dev`; commit first to see them.
- A permalink names the deployed commit, so after a later deploy it renders an honest "files at
  this commit aren't in the build" state instead of the old file.

### Neutral

- A commit that touches Delta and other workspaces shows only Delta's files in its patch.
- Tests assert shape (sorted, every cited sha known, no email, under budget), never specific
  shas or counts.

## Alternatives Considered

- **Reading git from the Worker at request time:** impossible, a Worker has neither git nor
  the repository.
- **Committing the generated JSON:** a commit could not contain its own sha or patch, and the
  history would describe itself one commit late.
- **Serving the JSON from static assets now:** adds an internal fetch per isolate for data that
  fits the bundle today; kept as the escape hatch.

## References

- `docs/research/github-demo.md`, §4.1–§4.4 (decisions D2, D3, D10)
- `apps/sdxc-site/scripts/extract-delta.ts`, `apps/sdxc-site/scripts/delta.ts`
- `apps/sdxc-site/app/services/delta/source.ts`
