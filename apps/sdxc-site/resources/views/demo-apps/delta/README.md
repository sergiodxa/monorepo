# Delta

Delta is the code-hosting demo on [sdxc.dev](https://sdxc.dev/demo), built from
[@sdxc/ui](https://sdxc.dev/api/ui). The one repository it hosts, `sdxc/delta`, is Delta
itself: the file you are reading is the README of the folder that holds Delta's screens, and
every file, commit, author and blame line you can open here is real.

Only Delta's own folder is browsable. The packages it imports, such as `@sdxc/ui` and
`@sdxc/highlight`, appear as import specifiers and nothing more.

## How a Worker shows git history

Delta runs on Cloudflare Workers, which have no filesystem and no git. So the history is read
before the Worker exists: when the site builds, a script pins the current commit, reads this
folder's files at that commit, the latest commits that touch it with their patches, and
`git blame` for every file, then writes them as JSON next to the code. Commit authors are kept
by name only, and every email is dropped. The Worker loads that JSON on the first request that
needs it and tokenizes each file once, so later requests reuse the work.

Because the data is baked at build time, each deploy shows the history up to the commit it was
built from, and a commit can never contain its own sha. The script lives outside this folder,
in [`scripts/extract-delta.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/scripts/extract-delta.ts).

## What to try

- Press `t` and type a few letters of a file name.
- Open a file, click a line number, then shift-click another to cite a range.
- Press `y` on a file to pin its address to the commit it was built from.
- Switch a file to **Blame** to see which commit last changed each line.
