---
title: Use a package from the terminal
description: Run a package's own command line with sdxc pkg to decode a token, check a domain, render a diagram or convert a contact card, and script it with --json and exit codes.
section:
    title: Operations & testing
    order: 9
order: 8.5
lastUpdated: 2026-11-01
outcomes:
    - "How to run any package's command line with `sdxc pkg`, without installing the package"
    - "How every package command line reads input, prints reports and exits, so scripts and CI can rely on it"
    - "Which packages ship a command line and what each one does"
---

Many packages do work you also want at a terminal: generating a key pair, decoding a token
someone pasted into a ticket, checking a domain's mail records before a launch. Those packages
ship a small command line beside the library that calls the same functions your app does, and
the `sdxc` command runs any of them. This guide runs one, scripts it, and lists every package
that has one.

## Run one with sdxc pkg

Install `sdxc` once, as [The sdxc command](/docs/getting-started/the-sdxc-command) shows:

```bash
npm add -g @sdxc/kit
```

`sdxc pkg` followed by a package's name runs that package's command line, with everything
after the name passed to it as typed:

```bash
sdxc pkg jwt decode eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2ln
```

Inside a project that installs `@sdxc/jwt`, it runs that version. Anywhere else it downloads
the published package with `bunx`, or with `npx` when Bun is missing, so nothing needs
installing first. `sdxc pkg` alone lists every package with a command line.

A project that pins its `@sdxc` packages to a release gets the command line from that same
release. In a project on `2026.10.25`, `sdxc pkg jwt` runs the newest `@sdxc/jwt` published
on or before that date, so the command line decodes and signs tokens the way your app's code
does. Outside a project, or in one that pins no `@sdxc` package, it runs the newest version.

A mistyped name runs nothing and suggests the closest match, arguments included:

```text
No @sdxc package command line is named "uiid". Did you mean `sdxc pkg uuid v4 -n 3`?
```

> [!TIP]
> A package without a command line yet answers with a link to request one. The request opens
> in the project's discussions with the package name as its title, and says what you'd use it
> for, so the most wanted command lines get built first.

## Script it with --json and exit codes

Every package command line behaves the same way, so a script written against one reads the
others:

- **Input** comes from a path argument, or from stdin when the argument is `-` or left out, so
  commands chain with pipes.
- **Output** goes to stdout, and diagnostics to stderr.
- **`--json`** prints any report as JSON with a stable shape, for scripts and agents. Without
  it the output is meant for people.
- **Exit codes**: `0` the command did its work, `1` it ran and found a problem (an invalid
  signature, a missing DMARC record, a domain about to expire), `2` the arguments or the input
  could not be read.
- **Secrets** such as signing keys and passwords are read from a file, stdin or a named
  environment variable, never from an argument, so they stay out of shell history.
- **`--help`** on any command lists its arguments and flags.

Exit code `1` makes a check usable in CI as it is:

```bash
sdxc pkg email-auth check example.com --json > email-auth.json
```

The step fails when a policy is missing, and the JSON report is there to read.

## Find the command line you need

| Package                                           | Command                     | What it does                                                            |
| ------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------- |
| [`@sdxc/cron`](/api/cron)                         | `sdxc pkg cron`             | Next occurrences of a schedule, a plain-English description, validation |
| [`@sdxc/crypto`](/api/crypto)                     | `sdxc pkg crypto`           | Random tokens, hashes, HMACs, TOTP codes, scrypt password hashes        |
| [`@sdxc/diagram`](/api/diagram)                   | `sdxc pkg diagram`          | Render a Mermaid file to SVG, or check it                               |
| [`@sdxc/distill`](/api/distill)                   | `sdxc pkg distill`          | Extract the article from a web page                                     |
| [`@sdxc/doh`](/api/doh)                           | `sdxc pkg doh`              | DNS lookups over HTTPS                                                  |
| [`@sdxc/email-address`](/api/email-address)       | `sdxc pkg email-address`    | Check addresses for syntax, disposable domains and mail servers         |
| [`@sdxc/email-auth`](/api/email-auth)             | `sdxc pkg email-auth`       | Check a domain's DMARC, SPF, MTA-STS, TLS-RPT, BIMI and DKIM            |
| [`@sdxc/font`](/api/font)                         | `sdxc pkg font`             | Inspect a font, or subset it to the characters a page uses              |
| [`@sdxc/html`](/api/html)                         | `sdxc pkg html`             | Query a page by role and accessible name, or print its outline          |
| [`@sdxc/http-signatures`](/api/http-signatures)   | `sdxc pkg http-signatures`  | Sign a request, or verify a signed one                                  |
| [`@sdxc/icalendar`](/api/icalendar)               | `sdxc pkg icalendar`        | Validate a calendar, expand its recurrences, try out an RRULE           |
| [`@sdxc/ip`](/api/ip)                             | `sdxc pkg ip`               | Classify an address, check whether a range contains it                  |
| [`@sdxc/jscalendar`](/api/jscalendar)             | `sdxc pkg jscalendar`       | Convert to and from iCalendar, expand recurrences, validate             |
| [`@sdxc/jscontact`](/api/jscontact)               | `sdxc pkg jscontact`        | Convert between vCard, jCard and JSContact, validate                    |
| [`@sdxc/jsdoc`](/api/jsdoc)                       | `sdxc pkg jsdoc`            | Extract JSDoc from source files into a documentation model              |
| [`@sdxc/json-canonical`](/api/json-canonical)     | `sdxc pkg json-canonical`   | Canonicalize JSON, hash the canonical form                              |
| [`@sdxc/json-patch`](/api/json-patch)             | `sdxc pkg json-patch`       | Apply, diff and validate JSON Patch documents                           |
| [`@sdxc/jsonc`](/api/jsonc)                       | `sdxc pkg jsonc`            | Check JSON with comments, strip it to plain JSON                        |
| [`@sdxc/jsonpath`](/api/jsonpath)                 | `sdxc pkg jsonpath`         | Query JSON with JSONPath                                                |
| [`@sdxc/jwt`](/api/jwt)                           | `sdxc pkg jwt`              | Decode, verify and sign tokens, generate signing keys                   |
| [`@sdxc/merge-patch`](/api/merge-patch)           | `sdxc pkg merge-patch`      | Apply and diff JSON Merge Patch documents                               |
| [`@sdxc/openapi`](/api/openapi)                   | `sdxc pkg openapi`          | Check an OpenAPI document                                               |
| [`@sdxc/openpgp`](/api/openpgp)                   | `sdxc pkg openpgp`          | Generate keys, sign, verify, inspect a key                              |
| [`@sdxc/qr`](/api/qr)                             | `sdxc pkg qr`               | Encode text as a QR code, to SVG or PNG                                 |
| [`@sdxc/rdap`](/api/rdap)                         | `sdxc pkg rdap`             | Look up a domain's registration, fail when it expires soon              |
| [`@sdxc/robots`](/api/robots)                     | `sdxc pkg robots`           | Check a URL against robots.txt, parse a robots.txt                      |
| [`@sdxc/security-headers`](/api/security-headers) | `sdxc pkg security-headers` | Audit a page's security headers, parse a CSP                            |
| [`@sdxc/semver`](/api/semver)                     | `sdxc pkg semver`           | Validate, compare and sort versions                                     |
| [`@sdxc/sitemap`](/api/sitemap)                   | `sdxc pkg sitemap`          | List and validate a sitemap's URLs                                      |
| [`@sdxc/typeid`](/api/typeid)                     | `sdxc pkg typeid`           | Generate, parse and encode TypeIDs                                      |
| [`@sdxc/user-agent`](/api/user-agent)             | `sdxc pkg user-agent`       | Parse User-Agent strings, one per line from a log                       |
| [`@sdxc/uuid`](/api/uuid)                         | `sdxc pkg uuid`             | Generate v4 and v7 UUIDs, validate one                                  |
| [`@sdxc/web-push`](/api/web-push)                 | `sdxc pkg web-push`         | Generate VAPID keys, send a test notification                           |
| [`@sdxc/webmention`](/api/webmention)             | `sdxc pkg webmention`       | Discover an endpoint, send and verify Webmentions                       |
| [`@sdxc/well-known`](/api/well-known)             | `sdxc pkg well-known`       | Check a security.txt, fetch and validate well-known documents           |
| [`@sdxc/zone-file`](/api/zone-file)               | `sdxc pkg zone-file`        | Validate, parse and format DNS zone files                               |

The guide for each package shows its command line where it helps, and `--help` lists the rest.

## Where to go next

- [Build a command line](/docs/operations-and-testing/build-a-command-line) — the
  `@sdxc/cli` package every one of these is built on, for a tool of your own.
- [Your app's command line](/docs/operations-and-testing/your-apps-command-line) — commands
  that need your app's database and services.
- [Check a project](/docs/sdxc/check-a-project) — `sdxc doctor`, for checks that read your
  project.
