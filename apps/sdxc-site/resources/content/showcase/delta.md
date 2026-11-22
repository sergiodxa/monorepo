---
title: Delta
headline: A code host that browses its own git history from a Worker with no filesystem and no git
summary: An invented code host whose one repository is its own source, read from git at build time, with blame, issues, pull request reviews, Actions logs and an inbox.
cover: blob
shots:
  - id: blob
    page: "delta/blob/main/shell.tsx?L=12-18"
    alt: Delta's file view of shell.tsx, with the file tree beside highlighted code and lines 12 to 18 marked from the address.
  - id: tree
    page: "delta/blob/main/shell.tsx?L=12-18"
    highlight: "#delta-files"
    alt: The file tree beside the code, with a filter box and the open folder's files.
  - id: files-changed
    page: "delta/pull/57/files?diff=split"
    alt: A pull request's Files changed tab in split view, with a tree of changed files and review threads between the lines they cite.
  - id: review-thread
    page: "delta/pull/57"
    highlight: "[data-slot='review-thread']:has([data-slot='review-thread-suggestion'])"
    alt: A review thread in the pull request conversation, with the diff it is about, a reviewer's comment, a suggested change, a reply box and Resolve conversation.
  - id: merge-box
    page: "delta/pull/57"
    highlight: "[data-slot='merge-box']"
    alt: The merge box summing up reviews, check runs and conflicts above a merge button with merge, squash and rebase.
  - id: job-log
    page: "delta/actions/runs/815/job/4"
    highlight: "[data-slot='log-viewer']"
    wait: 4000
    alt: A running job's log, one fold per step with the Run tests step open on its test output, a log search and a Show timestamps toggle.
  - id: issues-query
    page: "delta/issues?q=is%3Aopen+label%3Abug&sort=comments"
    highlight: "[data-slot='filter-bar']"
    alt: The issues list's filter bar holding the query is:open label:bug, with Open and Closed counts and the Author, Labels and Assignees facets.
  - id: phone-home
    page: "delta"
    viewport: phone
    alt: Delta's repository home on a phone, with the latest commit, the file list and the README.
---

Delta is an invented code host. Its one repository, `sdxc/delta`, is Delta's own folder of
source: every file, commit, author and blame line you can open in it is real, read from git when
the site builds. The issues, pull requests, reviews and workflow runs around that code are
invented, but each one points at real commits and real lines, so a review thread quotes code that
exists and a failed check cites lines you can click. Brass on warm graphite, with monospace for
shas, refs and paths, tight rows and small radii.

The demo sets out to answer two questions. How does a Worker with no filesystem and no git show
git history? And how far can one app go with server-rendered screens that patch in place? The
file tree survives every file you open, a running job's log streams in a line at a time, and
merging, reviewing, triaging notifications and changing settings all post without leaving the
page. With script off, every one of them is still a link or a form.

## The brief

A code host is a reading tool first. Files must be easy to find and cite by line, blame has to
say who last touched each line, and the commit history must be honest. On top of reading sits
collaboration: issues filtered in a query language people already know, pull requests whose
conversation mixes comments, pushes and reviews, a merge box that answers "can I merge?", a
diff you can review file by file, CI runs with readable logs, and an inbox that can be cleared
from the keyboard.

Delta takes on all of that. Its constraint is the runtime: the site runs on Cloudflare Workers,
so there is no `git` binary and no checkout to read at request time.

## Git history baked into the build

The history is read before the Worker exists. When the site builds,
`scripts/extract-delta.ts` pins the current commit, reads the folder's files at that commit, the
latest commits that touch it with their patches, the last commit for every path and
`git blame` for every file, then writes them as JSON beside the code:

```ts
let top = git(["rev-parse", "--show-toplevel"], APP).trim();
let head = git(["rev-parse", "HEAD"], top).trim();
let shallow = git(["rev-parse", "--is-shallow-repository"], top).trim() === "true";

let files = readFiles(top, head);
let known = new Map<string, DeltaCommitMeta>();
let history = shallow ? emptyHistory(head) : readHistory(top, head);
```

Commit authors are kept by name only and every email is dropped. Each commit's patch is limited
to Delta's files, blame is compacted to line ranges, and the build stops if the documents grow
past their size budget. A shallow clone still builds, with an empty history flagged as such. The
Worker loads each document on the first request that needs it and tokenizes each file once per
isolate, so later requests reuse the work. Because the data is baked at build time, each deploy
shows the history up to the commit it was built from.

## A file view built for citing

The file view puts the tree beside the code. The tree lives outside the swapped `main` frame, so
its open folders, its filter and its scroll position survive every file you open.

![The file tree beside the code, with the open folder's files and the current file marked](/showcase/delta/tree.webp "The tree sits outside the swapped main frame, so its open folders and scroll survive every file.")

[CodeView](/api/ui/code-view) switches between Code and Blame. Click a line number, shift-click
another, and the address carries `?L=12-18`, which the server paints, so a cited range arrives
highlighted before any script runs. `y` pins the address to the commit the build read, a
[FilterMenu](/api/ui/filter-menu) picks the branch, and `t` opens Go to file in the
[CommandPalette](/api/ui/command-palette), ranked by fuzzy match and also available as a
no-script `/find?q=` page. The commits list groups real commits by day, with co-authors from
`Co-Authored-By` trailers and a short sha that copies the full one.

## Issues in a query grammar

The issues list reads one query in GitHub's grammar, starting at `is:open`: `is:closed`,
`label:bug`, `author:kenji`, `assignee:@me`, `no:assignee`, `milestone:"Delta 1.0"` or free
words. A [FilterBar](/api/ui/filter-bar) holds the query, Open and Closed tabs that count their
state, and Author, Labels and Assignees facets with counts. Every filter lives in the address, so
a filtered list is a link.

![The issues filter bar holding the query is:open label:bug, with Open and Closed counts and facets](/showcase/delta/issues-query.webp "Facets and the typed query are two editors of the same address, so either one reproduces the view.")

`j` and `k` walk the rows, Enter opens one, `x` selects it and `/` focuses the query. Selecting
rows turns the footer into a [SelectionBar](/api/ui/selection-bar): Close or Reopen and Assign
to me post once for every checked issue and redraw the list in place with one toast.

## Pull requests you can review and merge

Each pull request is a real range of Delta's commits, picked by the subjects of its first and
last commit when the site builds, so its commits, checks and threads point at real code and keep
working as the history grows. The header sticks and compacts as the conversation scrolls. The
timeline mixes comments, pushes with each commit's check icon, reviews and merges. Each review
shows the threads it left above the code they are about, as a
[ReviewThread](/api/ui/review-thread): open, resolved and folded to one line, outdated and
showing the code as it was, or carrying a suggested change. Reply and Resolve post and redraw the
page in place.

![A review thread with the diff it is about, a comment, a suggested change, Reply and Resolve](/showcase/delta/review-thread.webp "A thread shows the code it is about and a suggested change, and Reply and Resolve post in place.")

The [MergeBox](/api/ui/merge-box) answers "can I merge?" from reviews, every
[CheckRuns](/api/ui/check-runs) result (failures first, open when one failed) and conflicts,
then offers a split button with merge, squash and rebase. Merging redraws the page in place: the
pill turns Merged, a merged event appears and a toast confirms it. A failing check or a missing
approval blocks the button and says why.

![The merge box summing up reviews, checks and conflicts above the merge button](/showcase/delta/merge-box.webp "Each row answers one part of can I merge, and the button stays blocked until all three agree.")

Files changed renders the real diff of the commit range with [Diff](/api/ui/diff) and
[@sdxc/diff](/api/diff), beside a tree of the changed files with each one's status letter and
counts. Unified or split stays in the address as `?diff=split`, and split lays out as unified on
a phone. Each file has a Viewed mark that posts and collapses the file while the toolbar counts
"n / N files viewed". A line's `+`, or a drag across line numbers, opens a comment form under
those lines; a comment posts on its own or joins a pending review that "Finish your review"
submits. Large files wait behind a "Load diff" served by
[@sdxc/lazy-frame](/api/lazy-frame).

![Files changed in split view, with a tree of changed files and a viewed counter](/showcase/delta/files-changed.webp "The changed-files tree shows each file's status and counts, and Viewed burns the review down.")

## Actions with a live log

The Actions tab lists every workflow run as a two-line row with its state, the commit it built,
the workflow, the branch and how long it took, with workflow, status, branch and actor filters in
the address. The list refreshes itself on an [AutoRefresh](/api/ui/auto-refresh) interval. Runs
are invented, but each builds a real commit from the history, and the newest run is always still
going. A run's page shows the job graph and the findings it raised, each linking to the exact
lines it cites in Delta's own files.

A job's page lists the run's jobs beside its log in a [LogViewer](/api/ui/log-viewer): one fold
per step with the failed or running step open, `##[group]` folds, ANSI colours drawn as a
terminal would, a log search and a Show timestamps toggle. The running job's log streams one
line at a time from `ci.tsx` and follows the tail; without script, it shows the lines so far and
a Refresh link.

![A running job's log, folded by step with the Run tests step open](/showcase/delta/job-log.webp "Each step folds on its own, and the running step stays open on its output.")

## An inbox, profiles and settings

Notifications are a keyboard inbox: `j` and `k` walk them with an inset ring, `x` selects, and
`e` marks the focused one done and moves to the next. Profiles show a
[ContributionGraph](/api/ui/contribution-graph) by year. Settings save each switch as it flips,
hold the branch protection rule on `main`, and put archive and delete in a
[DangerZone](/api/ui/danger-zone); deleting asks for the repository's full name and offers Undo
in its toast.

On a phone, the sidebar becomes a sheet, the repository tabs fold behind More, and file rows keep
their names and dates.

![Delta's repository home on a phone, with the latest commit and the file list](/showcase/delta/phone-home.webp "On a phone the repository tabs fold behind More and the file list keeps names and dates.")

## Takes after

- [GitHub](https://github.com) — the repository home, blame, the issue query grammar, pull
  request reviews with a merge box, and Actions run and job pages; Delta reads all of its code
  and history from a build-time snapshot of its own folder.
- [GitLab](https://gitlab.com) — a merge widget that sums up approvals and pipeline state in one
  place before the merge button.
- [Sourcegraph](https://sourcegraph.com) — code links that cite a line range and pin to an exact
  commit.

## Where to start reading

- [`README.md`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/delta/README.md)
  — how a Worker shows git history, and a tour of what to try.
- [`scripts/extract-delta.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/scripts/extract-delta.ts)
  — the build step that reads files, commits, patches and blame from git.
- [`ci.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/delta/ci.tsx)
  — the invented runs and the live job log stream.
