# ADR-187: Package Command Lines

## Status

**Implemented** - 2026-10-31

## Background

Three packages ship a `bin` today: `@sdxc/kit` (`sdxc`), `@sdxc/spec` (`spec`) and `@sdxc/mcp`
(`mcp-bridge`). Many more already hold the whole of an operation a developer runs by hand while
building or operating an app: generating a VAPID key pair, decoding a JWT, rendering a Mermaid
file to SVG, checking a domain's DMARC and SPF records, converting a vCard to JSContact. Today
each of those means writing a throwaway script against the package's API, or reaching for an
unrelated tool that disagrees with the package on the edge cases.

`@sdxc/cli` (ADR-145) now owns parsing, help, prompts, exit codes and a test harness, so a
package command line costs a contract and a few thin handlers. This ADR sets when a package gets
one, what shape it takes, and which packages go first.

## Context

### Existing command lines

| Package      | Bin          | Entry                 | Built on    | Runtime shebang |
| ------------ | ------------ | --------------------- | ----------- | --------------- |
| `@sdxc/kit`  | `sdxc`       | `src/bin.ts`          | `@sdxc/cli` | `node`          |
| `@sdxc/spec` | `spec`       | `src/cli.ts`          | `@sdxc/cli` | `bun`           |
| `@sdxc/mcp`  | `mcp-bridge` | `src/bridge/index.ts` | hand-rolled | `bun`           |

The release (ADR-007) already rewrites every `bin` target from `src/*.ts` to `dist/*.js` in the
publish manifest, so a package adds a command line without any release change.

### What separates a good candidate

Across the ~150 packages, the ones that would gain from a command line share three traits: the
package already implements the operation end to end, the operation is run by a person or a
script at development or operations time, and its input and output are a file, a string, a URL
or a hostname. Middleware, storage adapters, UI and building blocks (`result`, `iife`, `types`)
have none of the three.

Some useful checks need the app itself — its layout, configuration or translations. Those
belong to `sdxc`, which already knows the project; `sdxc diagram` is the existing example, a
project-aware command that calls `@sdxc/diagram` for the rendering.

## Decision

A package ships a command line when it meets all of these:

1. **The library already does the work.** Handlers parse input, call the package's public API
   and format the result. Logic a handler would need first lands in the library, with its tests.
2. **It is run outside the app.** Generate, convert, inspect, check or render — at a terminal,
   in CI or from an agent. Code that only makes sense inside a request or a job does not qualify.
3. **It needs no knowledge of an app.** Anything that reads a project's layout, config, bindings
   or locales is an `sdxc` command (or an `sdxc doctor` check) that calls the package instead.

### Shape

Every package command line follows the `spec` layout:

| File                   | Holds                                                                          |
| ---------------------- | ------------------------------------------------------------------------------ |
| `src/cli-contract.ts`  | the `commands({ … })` contract: arguments, flags, help                         |
| `src/cli.ts`           | `createCLI`, one `cli.map(contract.x, lazy(() => import(…)))` per command, run |
| `src/cli-<command>.ts` | one default-exported `createCommand` handler per command                       |
| `src/cli.test.ts`      | tests through `cli.invoke()`, asserting stdout, stderr and the exit code       |

```json
{
	"bin": { "sdxc-jwt": "./src/cli.ts" },
	"dependencies": { "@sdxc/cli": "workspace:*" }
}
```

```ts
#!/usr/bin/env node
export const cli = createCLI({ name: "sdxc-jwt", commands: JWT_COMMANDS });

cli.map(
	JWT_COMMANDS.decode,
	lazy(() => import("./cli-decode.js")),
);
cli.map(
	JWT_COMMANDS.keygen,
	lazy(() => import("./cli-keygen.js")),
);

if (import.meta.main) process.exit(await cli.run(process.argv.slice(2)));
```

Conventions every command follows:

- **Bin name `sdxc-<package>`.** A plain package name can collide: `semver` and `uuid` are
  already the bins of widely installed packages, and npm links an indirect dependency's bins
  into a project's `node_modules/.bin` too, so a script calling `semver` could run either. The
  prefix keeps every global install and project script unambiguous, and nobody needs to type
  it: `sdxc pkg <name>` and `npx @sdxc/<name>` reach it by package. `sdxc`, `spec` and
  `mcp-bridge` keep their current names.
- **Node shebang.** The entry starts `#!/usr/bin/env node`, so the published bin runs under
  `npx` as well as `bunx`; handlers use Web APIs plus `node:fs` / `node:process` only.
- **Filter behavior.** Input comes from a path argument or stdin when the argument is `-` or
  absent; output goes to stdout, diagnostics to stderr.
- **`--json` on every command that prints a report**, with a stable shape an agent or script
  can read; the default output is for people.
- **Exit codes as `spec` and `sdxc` use them**: `0` done, `1` the check ran and found problems
  (an invalid token, a failing DMARC policy, a lint finding), `2` usage or unreadable input.
- **Secrets never hit argv by default.** Commands that take a key or a password read it from a
  file, stdin or a named environment variable (`--key-file`, `--key-env`), so it stays out of
  shell history and process listings.
- **Network commands go through `@sdxc/outbound`** whenever the package already does for a
  stranger-chosen URL, with the same deadline and body bounds as the library.
- **Documentation.** The package README gets a short "Command line" section with the install
  line and one example per command; `--help` generated from the contract is the full reference.

### Run them through `sdxc pkg`

`sdxc pkg <name> [command] [options]` runs a package's command line with every token after the
name passed through untouched, so one global `sdxc` reaches all of them without installing any:

- **Resolution.** The kit looks for `@sdxc/<name>` in a `node_modules` at or above the working
  directory, then in the workspace that contains it (so this repository runs its checked-out
  source), and runs that binary under Bun when Bun is on `PATH`, Node otherwise. With neither,
  it downloads the published package through `bunx --bun --package @sdxc/<name> sdxc-<name>`,
  or `npx --yes --package …` without Bun. `bunx` and `npx` alone skip a workspace's own
  packages and need the binary named, which is why the kit resolves the local copy itself.
- **A known list.** `packages/kit/src/pkg/catalog.ts` names every package with a command line,
  with what it does for `sdxc pkg`'s listing, and every published package without one;
  `test/package-bins.test.ts` holds it to `packages/*`.
- **Typos.** An unknown name never runs. It exits 2 with the closest name that has a command
  line, as `closest()` from `@sdxc/cli` picks it, and the suggestion repeats the arguments:
  ``Did you mean `sdxc pkg uuid v4 -n 3`?``. `@sdxc/<name>` and `sdxc-<name>` resolve too.
- **Requests.** A package without a command line exits 2 with a link to a new discussion in
  the repository's Ideas category, titled with the package only, so nothing else typed leaves
  the machine. `.github/DISCUSSION_TEMPLATE/ideas.yml` asks what it would be used for, an
  example command and the expected output; votes on the discussion show demand.
- **No prefix clash.** `pkg` keeps package names apart from the kit's own commands:
  `sdxc diagram` draws a project's architecture and `sdxc pkg diagram` runs `@sdxc/diagram`.

### First wave

Each is a thin layer over an API that exists today.

| Package            | Commands                                                                             |
| ------------------ | ------------------------------------------------------------------------------------ |
| `@sdxc/jwt`        | `decode`, `verify --jwks <url>`, `sign`, `keygen` (JWK or PEM)                       |
| `@sdxc/crypto`     | `token` (a secret for `cf workers secrets update`), `hash`, `hmac`, `totp`, `scrypt` |
| `@sdxc/web-push`   | `vapid keygen`                                                                       |
| `@sdxc/diagram`    | `render <file.mmd>` to SVG                                                           |
| `@sdxc/qr`         | `encode <text>` to SVG, or PNG through `@sdxc/png`                                   |
| `@sdxc/email-auth` | `check <domain>`: DMARC, SPF, MTA-STS, TLS-RPT, BIMI and DKIM                        |
| `@sdxc/openapi`    | `check <document>`                                                                   |

### Later candidates

Accepted under the same rules, taken on when a need comes up:

- **Converters:** `jscontact` (vCard / jCard / JSContact), `jscalendar` and `icalendar`
  (convert, expand recurrences, validate), `yaml`, `jsonc`, `csv`, `jsonl`, `opml`, `feed`
  (`discover`, normalize to JSON Feed), `font` (`inspect`, `subset`).
- **JSON tools:** `jsonpath` (query), `json-patch` and `merge-patch` (`apply`, `diff`),
  `json-canonical`.
- **Diagnostics:** `rdap`, `doh`, `zone-file`, `robots`, `sitemap`, `security-headers`,
  `well-known`, `webmention`, `distill`, `html`, `user-agent`, `ip`, `email-address`.
- **Identifiers and schedules:** `uuid`, `typeid`, `semver`, `cron` (`next`, `describe`),
  `jsdoc` (`extract`).
- **Signing:** `http-signatures`, `openpgp`.

### Routed to `sdxc` instead

Translation checks (missing keys, invalid MessageFormat 2 in `resources/locales/`) read an app's
files, so they become an `sdxc doctor` check built on `@sdxc/messageformat`, not a bin in
`@sdxc/i18n`.

## Consequences

### Positive

- **One implementation per operation** - the command line and the library cannot disagree on an
  edge case, because the command line has none of its own logic.
- **Usable by agents** - `--json` and fixed exit codes let `sdxc upgrade` prompts, CI and agents
  call the same tools a person does.
- **Cheap to add** - `@sdxc/cli` supplies help, parsing and a test harness; a candidate costs a
  contract and a handful of short handlers.
- **Discoverable packages** - `bunx @sdxc/<name> --help` shows what a package does without
  writing code.

### Negative

- **A new dependency for library consumers** - every package with a command line depends on
  `@sdxc/cli`, which installs alongside the library even for consumers who never run the bin.
  `lazy()` keeps it out of any runtime import graph, so bundles are unaffected.
- **More surface to keep stable** - flags and `--json` shapes are public API, released with
  the same dated versions and notes as the library's exports.
- **Longer bin names** - `sdxc-jwt` is longer to type than `jwt` for a global install.

### Neutral

- **Release unchanged** - `bin` targets already move to `dist/` in the publish manifest.
- **Existing bins keep their names** - `sdxc`, `spec` and `mcp-bridge` are already published.

## Implementation Plan

### Phase 1: Convention

**Priority:** High

1. Add the bin naming, shebang and file-layout rules to `AGENTS.md` under Publishing.
2. Add a repo test that every `bin` in `packages/*` points at `src/cli.ts`, is named
   `sdxc-<directory>` (allowing the three existing names) and has a `src/cli.test.ts`.

### Phase 2: First wave

**Priority:** Medium

One commit per package, each with its contract, handlers, tests and README section: `jwt`,
`crypto`, `web-push`, `diagram`, `qr`, `email-auth`, `openapi`.

### Phase 3: Translation check

**Priority:** Low

Add the locale check to `sdxc doctor`.

## Alternatives Considered

### 1. One `sdxc` command with a subcommand per package

`sdxc jwt decode`, `sdxc qr encode` and so on, all inside `@sdxc/kit`.

**Rejected as a dependency because**: the kit would depend on every package that has a
command, so installing the scaffolding tool pulls in fonts, PDF, PGP and the rest; and a tool
like `sdxc-jwt` is useful in projects that never use the kit. Adopted as a launcher instead:
`sdxc pkg <name>` resolves and runs each package at the moment it is called.

### 2. A separate `@sdxc/tools` umbrella of command lines

**Rejected because**: it repeats the umbrella that ADR-183 dropped, and it splits each command
from the package whose release notes describe its behavior.

### 3. Short bin names matching the package

`jwt`, `qr`, `cron`, `yaml`.

**Rejected because**: those names are taken by widely installed npm packages, so a global
install would collide, and which one runs would depend on install order.

### 4. Scripts or examples in each README instead of a bin

**Rejected because**: copied scripts drift from the package and have no tests, `--json` or exit
codes for CI and agents.

## References

- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
- [ADR-145: `@sdxc/cli` Package](./ADR-145-cli-package.md)
- [ADR-148: The `sdxc` Command Line Ships as `@sdxc/kit`](./ADR-148-sdxc-kit-cli-package.md)
- [ADR-183: Drop the `sdxc` Umbrella Package](./ADR-183-drop-sdxc-umbrella.md)

## Current Progress

- [x] Phase 1: Convention (`AGENTS.md` rule, `test/package-bins.test.ts`)
- [x] Phase 2: First wave: `jwt`, `crypto`, `web-push`, `diagram`, `qr`, `email-auth`, `openapi`
- [x] Phase 3: Translation check (`sdxc doctor --only translations`)
- [x] Later candidates shipped alongside: `cron`, `distill`, `doh`, `email-address`, `font`,
      `html`, `http-signatures`, `icalendar`, `ip`, `jscalendar`, `jscontact`, `jsdoc`,
      `json-canonical`, `json-patch`, `jsonpath`, `merge-patch`, `openpgp`, `rdap`, `robots`,
      `security-headers`, `semver`, `sitemap`, `typeid`, `user-agent`, `uuid`, `webmention`,
      `well-known`, `zone-file`
- [x] Guides: "Use a package from the terminal" on sdxc.dev, and a terminal section in each
      package's guide
- [x] `sdxc pkg`, with typo suggestions and request links
- [x] `jsonc`
- [ ] Format converters: `yaml`, `csv`, `jsonl`, `opml`, `feed`
