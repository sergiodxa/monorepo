---
title: plumb
headline: A library landing that leads with code, from a copyable install line to a benchmark that shows its slow case
summary: A landing for an invented TypeScript schema library that compiles to plain JavaScript, led by code, a typing terminal and an honest benchmark.
cover: hero
shots:
  - id: hero
    page: ""
    alt: The plumb landing, near-black and set in mono, a headline and an install line with package-manager tabs beside a terminal running the library.
  - id: install
    page: ""
    highlight: "[data-slot=install-tabs]"
    alt: The install line, npm, pnpm, bun and deno tabs over npm install plumb-schema with a copy button, and a quickstart link under it.
  - id: terminal
    page: ""
    highlight: "[data-slot=typed-terminal]"
    alt: A terminal installing plumb-schema, checking the User and Address schemas, benchmarking User.parse at 39.6M ops/s and printing one failed email with its path.
  - id: compile
    page: ""
    click: "label[for=plumb-compile-tab-1]"
    highlight: "#compile [data-slot=code-stage]"
    alt: The compile band on its user.compiled.js tab, a parseUser function of plain typeof checks and early returns, one per schema field.
  - id: runtimes
    page: ""
    highlight: "#runtimes [data-slot=code-stage]"
    alt: A code card with remix.ts, hono.ts, next.ts and worker.js tabs, showing a Remix route that parses a request body with User.safeParse.
  - id: benchmark
    page: ""
    highlight: "#benchmarks [data-slot=split]"
    alt: The benchmark band, bars for a hand-written guard, plumb 4.2 compiled, plumb 3.9 interpreted and invalid input, beside the machine, runtime, input, harness, commit and how to reproduce.
  - id: community
    page: ""
    highlight: "[data-slot=contributor-wall]"
    alt: A mosaic of contributor initials in two rows, ending on a tile reading +179.
  - id: phone
    page: ""
    viewport: phone
    alt: The plumb hero on a phone, the headline over the install line and the terminal, lime on near-black.
---

plumb is an invented TypeScript schema library whose schemas compile once to straight-line JavaScript, so parsing runs the checks a developer would have written by hand. The library does not exist; it installs as `plumb-schema` on this page because the bare `plumb` belongs to an unrelated package on npm. The page is an open-source library landing built from [@sdxc/ui](/api/ui) landing patterns, [@sdxc/u](/api/u) and [@sdxc/icons](/api/icons).

It is the demo to read for a developer-tool page that leads with code. The first screen is an install line and the tool running; the central claim is shown as the code it produces; the speed claim comes with the machine, runtime and commit it was measured on, and with the case where the library is slow. The art direction is near-black in both colour schemes, mono everything and one acid-lime accent, with a faint neon glow on the hero as the page's one flourish.

## The brief

A developer deciding on a library reads its landing page with suspicion. They want to know how to install it, what the code looks like in their own framework, whether the performance claim survives contact with a real benchmark, and whether the project will be maintained next year. Library sites often answer the first two and gesture at the last two with a star count.

plumb answers all four in order. Install lines and a typing terminal come first, then the schema beside what it compiles to, then the same call in four runtimes, then a benchmark with its full setup, then community figures with names, a release strip, a docs hub and a public account of where sponsorship money goes. Everything that switches (package managers, code files) is a radio group with CSS, so the page works the moment the HTML arrives.

## Installing in one copy

The hero's install line is [InstallTabs](/api/ui/install-tabs): npm, pnpm, Bun and Deno, each with its own command, and a [CopyButton](/api/ui/copy-button) that copies exactly the command it sits beside. A quiet "Read the quickstart" link sits under the strip.

![The install line, npm, pnpm, bun and deno tabs over npm install plumb-schema with a copy button, and a quickstart link under it](/showcase/plumb/install.webp "The tabs switch with CSS, and the copy button copies only the command beside it.")

The commands are data in `data.ts`, generated from one package-name constant, so the four lines and the import in every code sample name the same package. The tabs are radios styled with CSS and the command stays selectable text, so the line works before the copy button's script loads: a reader can still select and copy by hand. The same install line returns in the closing call, with the lime button centred under it.

## The tool doing what the headline says

Beside the install line, a [TypedTerminal](/api/ui/typed-terminal) plays a short session: add the package, check two schemas with field counts and timings, benchmark one, and print a failure with the path to the bad value.

![A terminal installing plumb-schema, checking the User and Address schemas, benchmarking User.parse at 39.6M ops/s and printing one failed email with its path](/showcase/plumb/terminal.webp "The terminal installs, checks and benchmarks, and ends on an error that names its path.")

The session types itself out, holds and loops, with a pause control; its static markup is the finished session, which is what a reader who asks for reduced motion sees. Ending on `users[812].email  not an email` is deliberate: a schema library is judged by its errors as much as its speed.

## Showing the compiled code

The compile band makes the page's central claim concrete. A [CodeStage](/api/ui/code-stage) holds two file tabs: `user.ts`, the schema a reader writes, and `user.compiled.js`, the function plumb generates from it.

![The compile band on its user.compiled.js tab, a parseUser function of plain typeof checks and early returns, one per schema field](/showcase/plumb/compile.webp "The compiled tab shows the function the schema becomes: one plain check per field, no interpreter.")

The compiled tab reads like code written by hand: a `typeof` check, a regular expression test or a range comparison per field, each failing early with the path and the expectation.

```js
let name = v.name;
if (typeof name !== "string" || name.length < 1 || name.length > 80)
	return out.fail(["name"], "string(1..80)", name);
```

The copy beside it names the one place compiling at runtime does not fit and how the library handles it, so the claim arrives with its limit.

## The same call in four runtimes

The runtimes chapter is a [Split](/api/ui/split) whose media bleeds to the page edge: a `CodeStage` with `remix.ts`, `hono.ts`, `next.ts` and `worker.js` tabs, each parsing a request body with `User.safeParse` and answering 422 with the issues or 201 with the record. Beside it, a [CheckList](/api/ui/check-row) states what the library implements: Standard Schema v1, ESM and CommonJS with types included, and issues that serialize to JSON as they are.

![A code card with remix.ts, hono.ts, next.ts and worker.js tabs, showing a Remix route that parses a request body with User.safeParse](/showcase/plumb/runtimes.webp "The first tab is a Remix route; the strip stays four files wide.")

The Remix tab uses `createRouter` from `remix/router` and a typed route, so a reader on that stack sees code they could paste. All four tabs are highlighted on the server.

## A benchmark with its setup

The benchmark band leads with one figure, User.parse on valid input, then a [DrawnChart](/api/ui/drawn-chart) of four bars: a hand-written guard, plumb 4.2 compiled, plumb 3.9 interpreted, and plumb 4.2 on invalid input. The headline beside it claims parity within 4% and then explains the slow bar: collecting every issue with its path allocates, so invalid input is slower, and the chart shows it.

![The benchmark band, bars for a hand-written guard, plumb 4.2 compiled, plumb 3.9 interpreted and invalid input, beside the machine, runtime, input, harness, commit and how to reproduce](/showcase/plumb/benchmark.webp "The chart keeps its slow case, and the setup it ran on sits beside it.")

Under the copy, a [PropertyList](/api/ui/property-list) records the machine, the runtime, the input, the harness, the commit and the command that reproduces the run. The chart's footnote says what the numbers mean: operations per second, higher is better, same machine, same input, same run.

## Names behind the numbers

The community band sets the repository's four counts in a [StatStrip](/api/ui/stat-strip), then a [ContributorWall](/api/ui/contributor-wall) of the people who committed to the project, ending on a tile for everyone else.

![A mosaic of contributor initials in two rows, ending on a tile reading +179](/showcase/plumb/community.webp "The contributor mosaic puts names behind the star count, ending on everyone else.")

A [ChangelogStrip](/api/ui/changelog-strip) lists recent releases, a docs hub of [Feature](/api/ui/feature) cards points at the guides with their reading times, and the licence band explains why plumb stays MIT with no paid tier: the month's income and what it pays for as a public ledger, above a tiered [SponsorWall](/api/ui/sponsor-wall) of companies and people. An FAQ and the closing call follow.

On a phone the hero stacks the headline, the install line and the terminal, each at full width.

![The plumb hero on a phone, the headline over the install line and the terminal, lime on near-black](/showcase/plumb/phone.webp "On a phone the install line comes before the terminal, both full width.")

## Takes after

- [Zod](https://zod.dev) — a TypeScript schema library introduced by its install line and a schema in the first screen; plumb adds the compiled output beside it.
- [Bun](https://bun.sh) — a dark, mono developer landing that leads with a benchmark chart and install commands; plumb's chart keeps its slow case and its setup.
- [Typia](https://typia.io) — validators generated ahead of time as plain code from TypeScript types, the idea plumb's compile band makes visible.
