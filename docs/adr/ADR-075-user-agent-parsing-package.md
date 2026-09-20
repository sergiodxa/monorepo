# ADR-075: User Agent Parsing Package

## Status

**Accepted** - 2026-09-20

## Background

A passkey is stored with a label, and the label is derived from the `User-Agent` header
of the request that enrolled it, because that is the only thing a WebAuthn ceremony knows
about the device on the other side. `apps/auth-saas` derives it with a chain of regular
expressions written inline in the module that stores the credential: three device tokens,
four operating systems, five browsers, and a comment explaining why Edge has to be tested
before Chrome.

The same reading is wanted in more than one place. A session list names where each session
was opened, a new-device email names the device it is warning about, and a download page
picks the build that matches the visitor. Each of those would otherwise grow its own chain,
and each chain would get the ordering subtleties right or wrong on its own.

## Context

### The ordering is the whole problem

Every value in a `User-Agent` string is borrowed. A Chromium browser keeps the `Chrome`
token so that sites written for Chrome serve it their working path, and every
WebKit-descended browser keeps `Safari` for the same reason. Edge appends `Edg/122`
_after_ `Chrome/122`; Samsung Internet appends `SamsungBrowser/23` _before_ it; Silk writes
`Silk/113.3.3 like Chrome/113`.

So a browser is not identified by finding a token, it is identified by finding the most
specific token first. That is an ordered list, and an ordered list is the kind of thing that
is correct once and stays correct only while it lives in one place with tests around it.

### Platform tokens do not answer the question they appear to

| The string says                | What is true                                         |
| ------------------------------ | ---------------------------------------------------- |
| `Windows NT 10.0`              | Windows 10 **or** Windows 11, which reports the same |
| `Mac OS X 10_15_7` from Safari | any macOS release, frozen at that number             |
| `Macintosh` from an iPad       | an iPad asked for the desktop site                   |
| `Android 10; K`                | Chromium withholding the model                       |
| `CriOS/122` on an iPhone       | Chrome's name over Apple's WebKit engine             |
| `Linux` inside an Android UA   | Android, which is read first                         |

Half of these are traps only if the reader assumes the string is a description of the
device. It is a compatibility artifact, and a parser's job is to report what the string
says plus the small number of substitutions it is safe to make.

### `bowser` exists

[`bowser`](https://www.npmjs.com/package/bowser) answers exactly this question and is the
reference for the shape. It is also 2.11.0 from 2021, ships a `Parser` object with
`getBrowser`/`satisfies`/`is` and a `parse` that returns loose `string` fields, and pulls
in a range-matching layer to support `satisfies({ chrome: ">100" })`. What is wanted here
is the data, in this repo's shapes, with the names as unions an editor can list.

## Decision

Add `@sdxc/user-agent`, with a single function and the types it answers with.

```ts
function parse(userAgent: string): UserAgent;

interface UserAgent {
	browser: { name: BrowserName | null; version: string | null };
	engine: { name: EngineName | null; version: string | null };
	os: { name: OperatingSystemName | null; version: string | null };
	device: { type: DeviceType | null; vendor: DeviceVendor | null; model: string | null };
}
```

### The read is total

`parse` takes any string and answers for the parts it recognizes, leaving the rest `null`.
There is no `Result` here, and that is a deliberate departure from the repo's default: a
`Result` exists so a caller can tell a refusal from an answer and do something about the
refusal. There is nothing to do about a `User-Agent` a rule set does not know — a crawler,
a script, a header someone removed — except carry on without it. A failure branch at every
call site would be ceremony around a value that is already optional, and a caller who wants
one writes `if (ua.browser.name === null)`.

A header that is absent is the caller's `?? ""`, which reads as every field `null`.

### Names are closed unions, versions are strings

`BrowserName`, `EngineName`, `OperatingSystemName`, `DeviceType` and `DeviceVendor` are
string unions of what the rules can produce. A `switch` over one is exhaustive, an editor
lists the options, and a typo is a type error. The cost is that a browser with no rule is
`null` rather than whatever token it happened to write, which is the honest answer anyway:
an unrecognized token is not a name, it is a string.

Versions stay `string`. Browsers number releases however they like — `17.4`,
`122.0.6261.89`, `11.0` — and none of those is semver, so parsing them into numbers would
invent structure the format does not have. A caller comparing major versions writes
`Number.parseInt(version, 10)`.

### Four independent readers, each an ordered table

`browser.ts`, `engine.ts`, `os.ts` and `device.ts` each own one ordered rule list and export
one detector; `parse.ts` calls all four. A string that is half recognized still answers for
the half it is — an unknown browser on a known system reports the system.

Browser and engine are literal tables of `{ name, pattern }`, read top to bottom, first
match winning, with the ordering subtleties as comments on the table rather than spread
through a chain of ternaries. Operating system and device are ordered sequences of small
named readers instead, because each platform needs its own arithmetic: mapping `NT 10.0` to
`10`, splitting iOS from iPadOS at version 13, skipping the locale and the Gecko revision an
Android build lists where a model would otherwise be.

### Which substitutions the package makes

It reports what the string says, with three exceptions, all of them documented at the point
they happen:

- Windows NT versions become marketing versions (`6.1` → `7`, `10.0` → `10`)
- Apple's underscore versions become dotted ones (`17_4` → `17.4`)
- An iPad reporting version 13 or later is `iPadOS` rather than `iOS`

It makes no guesses beyond those. A Chromium `K` model reads as no model, and an iPad in
desktop mode reads as a Mac, because that is what those strings contain.

## Consequences

### Positive

- One ordered rule set, with 57 tests over real user agent strings, instead of a chain per
  call site
- A label, a session list and a platform-specific download all read the same way
- The names are unions, so a consumer's `switch` is checked and a rename is a compile error
- No dependencies; the package is regular expressions and tables

### Negative

- A closed union means adding a browser is a package change, not a caller change
- The rules age. A new Chromium fork, a new model prefix or a new platform token needs a
  rule, and until it has one the field is `null`
- Detection from this header is inherently approximate, and the package inherits every
  ambiguity the format has — an iPad in desktop mode being the sharpest one

### Neutral

- `parse` is four regular expression sweeps over a short string, which is cheap enough to
  call per request without a cache
- Callers that want a boolean (`isMobile`) write the comparison themselves, which keeps
  the surface one function wide

## Alternatives Considered

### Depend on `bowser`

It works, and adding a dependency is less code than writing one. It is also unmaintained,
carries a range-matching layer nothing here needs, and types every name as `string`, which
gives a consumer's `switch` nothing to check. The rules are the valuable part and they are
small; owning them means the ordering comments live next to the ordering.

### A `Result`-returning parse

Consistent with the rest of the repo, and wrong for this input: there is no rejected input
to report. Every string is a legal `User-Agent`, including one nothing recognizes.

### Keep the regular expressions inline where the label is built

This is what exists today and it is fine in one place. It stops being fine at the second,
where the ordering rules get rediscovered, and the second call site is already known to be
coming.

### Parse the browser version into a comparable structure

Attractive for `browser.version >= 16` checks, but browser versions are not semver, and a
structure implying they are would be the parser making up an ordering the format does not
guarantee.

## References

- [`bowser`](https://www.npmjs.com/package/bowser), the package this one is shaped after
- [MDN: User-Agent](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/User-Agent)
- [MDN: Browser detection using the user agent](https://developer.mozilla.org/en-US/docs/Web/HTTP/Browser_detection_using_the_user_agent)
- [ADR-007](./ADR-007-publishable-package-releases.md), the release this package publishes through
