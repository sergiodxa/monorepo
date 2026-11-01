---
title: Use a package from the terminal
description: Run a package's own command line with npx to decode a token, check a domain, render a diagram or convert a contact card, and script it with --json and exit codes.
section:
    title: Operations & testing
    order: 9
order: 8.5
lastUpdated: 2026-10-31
outcomes:
    - "How to run a package's command line with npx or bunx, without installing it"
    - "How every package command line reads input, prints reports and exits, so scripts and CI can rely on it"
    - "Which packages ship a command line and what each one does"
---

Many packages do work you also want at a terminal: generating a key pair, decoding a token
someone pasted into a ticket, checking a domain's mail records before a launch. Those packages
ship a small command line beside the library, named `sdxc-<package>`, that calls the same
functions your app does. This guide runs one, scripts it, and lists every package that has one.

## Run one without installing it

npx downloads the package on first use and runs its command line:

```bash
npx @sdxc/jwt decode eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2ln
```

`bunx @sdxc/jwt …` works the same way. In a project that already depends on the package, the
`sdxc-jwt` binary is on the path of your `package.json` scripts.

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
npx @sdxc/email-auth check example.com --json > email-auth.json
```

The step fails when a policy is missing, and the JSON report is there to read.

## Find the command line you need

| Package                                           | Command                 | What it does                                                            |
| ------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------- |
| [`@sdxc/cron`](/api/cron)                         | `sdxc-cron`             | Next occurrences of a schedule, a plain-English description, validation |
| [`@sdxc/crypto`](/api/crypto)                     | `sdxc-crypto`           | Random tokens, hashes, HMACs, TOTP codes, scrypt password hashes        |
| [`@sdxc/diagram`](/api/diagram)                   | `sdxc-diagram`          | Render a Mermaid file to SVG, or check it                               |
| [`@sdxc/distill`](/api/distill)                   | `sdxc-distill`          | Extract the article from a web page                                     |
| [`@sdxc/doh`](/api/doh)                           | `sdxc-doh`              | DNS lookups over HTTPS                                                  |
| [`@sdxc/email-address`](/api/email-address)       | `sdxc-email-address`    | Check addresses for syntax, disposable domains and mail servers         |
| [`@sdxc/email-auth`](/api/email-auth)             | `sdxc-email-auth`       | Check a domain's DMARC, SPF, MTA-STS, TLS-RPT, BIMI and DKIM            |
| [`@sdxc/font`](/api/font)                         | `sdxc-font`             | Inspect a font, or subset it to the characters a page uses              |
| [`@sdxc/html`](/api/html)                         | `sdxc-html`             | Query a page by role and accessible name, or print its outline          |
| [`@sdxc/http-signatures`](/api/http-signatures)   | `sdxc-http-signatures`  | Sign a request, or verify a signed one                                  |
| [`@sdxc/icalendar`](/api/icalendar)               | `sdxc-icalendar`        | Validate a calendar, expand its recurrences, try out an RRULE           |
| [`@sdxc/ip`](/api/ip)                             | `sdxc-ip`               | Classify an address, check whether a range contains it                  |
| [`@sdxc/jscalendar`](/api/jscalendar)             | `sdxc-jscalendar`       | Convert to and from iCalendar, expand recurrences, validate             |
| [`@sdxc/jscontact`](/api/jscontact)               | `sdxc-jscontact`        | Convert between vCard, jCard and JSContact, validate                    |
| [`@sdxc/jsdoc`](/api/jsdoc)                       | `sdxc-jsdoc`            | Extract JSDoc from source files into a documentation model              |
| [`@sdxc/json-canonical`](/api/json-canonical)     | `sdxc-json-canonical`   | Canonicalize JSON, hash the canonical form                              |
| [`@sdxc/json-patch`](/api/json-patch)             | `sdxc-json-patch`       | Apply, diff and validate JSON Patch documents                           |
| [`@sdxc/jsonpath`](/api/jsonpath)                 | `sdxc-jsonpath`         | Query JSON with JSONPath                                                |
| [`@sdxc/jwt`](/api/jwt)                           | `sdxc-jwt`              | Decode, verify and sign tokens, generate signing keys                   |
| [`@sdxc/merge-patch`](/api/merge-patch)           | `sdxc-merge-patch`      | Apply and diff JSON Merge Patch documents                               |
| [`@sdxc/openapi`](/api/openapi)                   | `sdxc-openapi`          | Check an OpenAPI document                                               |
| [`@sdxc/openpgp`](/api/openpgp)                   | `sdxc-openpgp`          | Generate keys, sign, verify, inspect a key                              |
| [`@sdxc/qr`](/api/qr)                             | `sdxc-qr`               | Encode text as a QR code, to SVG or PNG                                 |
| [`@sdxc/rdap`](/api/rdap)                         | `sdxc-rdap`             | Look up a domain's registration, fail when it expires soon              |
| [`@sdxc/robots`](/api/robots)                     | `sdxc-robots`           | Check a URL against robots.txt, parse a robots.txt                      |
| [`@sdxc/security-headers`](/api/security-headers) | `sdxc-security-headers` | Audit a page's security headers, parse a CSP                            |
| [`@sdxc/semver`](/api/semver)                     | `sdxc-semver`           | Validate, compare and sort versions                                     |
| [`@sdxc/sitemap`](/api/sitemap)                   | `sdxc-sitemap`          | List and validate a sitemap's URLs                                      |
| [`@sdxc/typeid`](/api/typeid)                     | `sdxc-typeid`           | Generate, parse and encode TypeIDs                                      |
| [`@sdxc/user-agent`](/api/user-agent)             | `sdxc-user-agent`       | Parse User-Agent strings, one per line from a log                       |
| [`@sdxc/uuid`](/api/uuid)                         | `sdxc-uuid`             | Generate v4 and v7 UUIDs, validate one                                  |
| [`@sdxc/web-push`](/api/web-push)                 | `sdxc-web-push`         | Generate VAPID keys, send a test notification                           |
| [`@sdxc/webmention`](/api/webmention)             | `sdxc-webmention`       | Discover an endpoint, send and verify Webmentions                       |
| [`@sdxc/well-known`](/api/well-known)             | `sdxc-well-known`       | Check a security.txt, fetch and validate well-known documents           |
| [`@sdxc/zone-file`](/api/zone-file)               | `sdxc-zone-file`        | Validate, parse and format DNS zone files                               |

The guide for each package shows its command line where it helps, and `--help` lists the rest.

## Where to go next

- [Build a command line](/docs/operations-and-testing/build-a-command-line) — the
  `@sdxc/cli` package every one of these is built on, for a tool of your own.
- [Your app's command line](/docs/operations-and-testing/your-apps-command-line) — commands
  that need your app's database and services.
- [Check a project](/docs/sdxc/check-a-project) — `sdxc doctor`, for checks that read your
  project.
