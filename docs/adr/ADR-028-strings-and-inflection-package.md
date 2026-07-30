# ADR-028: Strings And Inflection Package

## Status

**Accepted** - 2026-07-29

## Background

Text manipulation is spread between a third-party inflection library and inline code. The `inflected` dependency is imported by four route or view modules across two applications and, more significantly, by a shared package, which means every consumer of that package inherits it.

A second dependency strips markdown to plain text in one app. That one is not a string concern at all: it is a markdown concern, and the monorepo already has a markdown package that owns parsing.

## Context

### Current State

| Location                                        | Usage                                                   |
| ----------------------------------------------- | ------------------------------------------------------- |
| `packages/jobs/src/index.ts`                    | `dasherize` and `underscore` to derive job identifiers  |
| `apps/r3-blog` article and tutorial view models | Inflection for display labels                           |
| `apps/r3-blog` glossary controller              | Same                                                    |
| `apps/blog` CMS controls and glossary route     | Same on the React Router stack                          |
| `apps/blog/app/utils/markdown.ts`               | `remove-markdown` to derive plain text from post bodies |

### Issues Identified

| Issue                                             | Impact                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| A shared package depends on an inflection library | The dependency propagates to every app that uses background jobs          |
| Slug generation is inline and inconsistent        | Diacritics and punctuation are handled differently per call site          |
| Truncation operates on code units                 | Cutting mid-grapheme produces broken output for emoji and combining marks |
| Markdown stripping lives in an app utility        | A markdown concern implemented outside the markdown package               |
| Title casing is done by hand or not at all        | Two headings in one list capitalize the same preposition differently      |

## Decision

Create `@pkg/strings` for text transformation and inflection, and move plain-text extraction into `@pkg/markdown` where it belongs.

### 1. Inflection

```ts
pluralize("monitor"); // "monitors"
singularize("monitors"); // "monitor"
camelize("cron_job_monitor"); // "cronJobMonitor"
underscore("cronJobMonitor"); // "cron_job_monitor"
dasherize("cron_job_monitor"); // "cron-job-monitor"
humanize("cron_job_monitor"); // "Cron job monitor"
ordinalize(3); // "3rd"
```

The default rule set covers English regular forms plus the common irregulars. Products with domain vocabulary create their own inflector rather than mutating global state:

```ts
let inflector = createInflector({
	irregular: [["status-page", "status-pages"]],
	uncountable: ["uptime", "downtime"],
});
```

This is the one behavioral difference from the library being replaced: no global registration, because a package that mutates shared inflection rules at import time makes results order-dependent.

`humanize()` produces sentence case and stays here beside the other inflections. Title case follows a style guide, so it gets its own section.

### 2. Title Case Follows The Chicago Manual Of Style

`titleize()` implements headline-style capitalization per the Chicago Manual of Style, with the same `special` escape hatch the `title` package on npm provides:

```ts
titleize("the state of javascript in 2026");
// "The State of JavaScript in 2026"

titleize("FaCEbook is great", { special: ["facebook"] });
// "facebook Is Great"
```

A `special` entry is matched case-insensitively against each word and rendered exactly as written in the entry, overriding every other rule including the small-word list. That is what makes it useful for names whose casing is not derivable: `iPhone`, `iOS`, `npm`, `PostgreSQL`, and a lowercase brand like the example above.

#### The Rules Implemented

| Rule                                              | Example                                          |
| ------------------------------------------------- | ------------------------------------------------ |
| Capitalize the first and last word, always        | `"to be continued"` to `"To Be Continued"`       |
| Lowercase articles                                | a, an, the                                       |
| Lowercase coordinating conjunctions               | and, but, or, nor, for, so, yet                  |
| Lowercase prepositions regardless of length       | `"a history of the world in six glasses"`        |
| Lowercase `as`, and `to` in an infinitive         | `"how to write"` to `"How to Write"`             |
| Capitalize the first word after a colon           | `"remix v3: the router"` to `"... : The Router"` |
| Capitalize both elements of a hyphenated compound | `"self-hosted"` to `"Self-Hosted"`               |
| A `special` entry wins over all of the above      | `special: ["iOS"]`                               |

Lowercasing prepositions regardless of length is the rule that distinguishes Chicago from AP style, which lowercases only prepositions shorter than four letters. It is also the rule that requires a preposition list, and English has well over a hundred prepositions, so the list is the part most likely to be incomplete.

#### Vocabularies Are Declared Once

An app that titles the same terms declares them once, matching how `createInflector()` works in this package:

```ts
let titleize = createTitleizer({
	special: ["JavaScript", "TypeScript", "GitHub", "iOS", "npm", "Remix"],
});

titleize("getting started with remix and typescript");
// "Getting Started with Remix and TypeScript"
```

`special` extends a small default set, and since a `special` entry always wins, an app overrides a default by listing the word with the casing it wants. Product and technology vocabulary lives in the app that publishes it.

### 3. Slugs

```ts
slugify("Cómo usar Remix v3"); // "como-usar-remix-v3"
slugify("Hello, World!", { separator: "_" }); // "hello_world"
```

Unicode normalization to NFKD, combining marks removed, non-alphanumerics collapsed into the separator, trimmed, lowercased. One implementation, so a slug generated in a CMS matches a slug generated in a job.

### 4. Grapheme-Safe Text Operations

```ts
truncate(text, { length: 140 }); // never splits a grapheme cluster
truncate(text, { length: 140, words: true }); // truncates at a word boundary
excerpt(text, { length: 200 }); // collapse whitespace, then truncate
wordCount(text, { locale });
initials("Sergio Xalambrí"); // "SX"
capitalize("remix"); // "Remix"
```

Truncation, word counting, and word-boundary logic use `Intl.Segmenter`, which makes them correct for non-Latin scripts and for emoji instead of only for ASCII.

### 5. Plain Text From Markdown Moves To `@pkg/markdown`

```ts
import { toPlainText } from "@pkg/markdown";

let text = toPlainText(markdown);
```

`@pkg/markdown-server` already parses markdown into an AST, so plain-text extraction is an AST walk rather than a regular-expression pass over source text. That is both more accurate (code fences, link titles, reference definitions, HTML blocks) and one less dependency. This replaces `remove-markdown` in the blog's markdown utility, and gives the excerpt and search-index paths a supported way to get text.

`@pkg/strings` stays markdown-unaware; the two packages compose as `toPlainText()` then `excerpt()`.

## Consequences

### Positive

- **A shared package sheds a dependency** - background jobs stop pulling an inflection library into every app.
- **Slugs are consistent** - one Unicode-aware implementation.
- **Titles follow one style guide** - Chicago rules in one tested place instead of per-heading judgment, with a `special` list for names whose casing cannot be derived.
- **Text operations stop breaking graphemes** - `Intl.Segmenter` handles what code-unit slicing gets wrong.
- **Markdown extraction becomes accurate** - AST-based instead of regular-expression-based, and owned by the markdown package.
- **Inflection rules are scoped** - no global mutable registry.

### Negative

- **Inflection rule coverage will have gaps** - the library being replaced has years of accumulated irregulars, so parity requires tests over the vocabulary actually in use.
- **The preposition list will be incomplete** - Chicago lowercases prepositions regardless of length, and English has well over a hundred of them, so an unlisted preposition is capitalized when it should not be.
- **Title casing cannot be fully automated** - whether a word is a preposition or an adverb depends on the sentence (`"turn on the light"` versus `"log on time"`), and a word-list implementation cannot tell the difference. Headings that matter should be checked, not trusted.
- **`Intl.Segmenter` is slower than slicing** - irrelevant per request, worth remembering in a loop over thousands of records.
- **Two migrations, not one** - inflection call sites and the markdown utility change independently.

### Neutral

- **English only** - inflection is English-specific by nature, and headline-style title case is an English convention that most languages do not share, so neither is safe to apply to translated copy. Localized strings come from the i18n layer already cased correctly.
- **Existing slugs are unaffected** - stored slugs are not regenerated, so the new implementation must be verified to produce identical output for existing content before adoption.

## Implementation Plan

### Phase 1: Inflection

**Priority:** High
**Estimated Effort:** 3 hours

1. Rule engine, default rules, `createInflector()`.
2. Parity tests over the terms currently inflected in both applications and in the jobs package.

### Phase 2: Title Case

**Priority:** Medium
**Estimated Effort:** 3 hours

1. Small-word lists (articles, coordinating conjunctions, prepositions), first and last word handling, colon and hyphen rules.
2. `special` matching and rendering, `createTitleizer()`, and the default special set.
3. Tests over the real headings in the repository's published content, since those are the titles the rules have to get right.

### Phase 3: Slugs And Text Operations

**Priority:** Medium
**Estimated Effort:** 3 hours

1. `slugify` with normalization tests including diacritics and non-Latin input.
2. `truncate`, `excerpt`, `wordCount`, `initials`, `capitalize` over `Intl.Segmenter`.
3. Verify `slugify` reproduces existing stored slugs.

### Phase 4: Markdown Plain Text

**Priority:** Medium
**Estimated Effort:** 2 hours

1. Implement `toPlainText()` as an AST walk in the markdown package.
2. Replace `remove-markdown` in the blog markdown utility and drop the dependency.

### Phase 5: Adoption

**Priority:** Medium
**Estimated Effort:** 2 hours

1. Replace `inflected` in the jobs package first, then in both apps; drop the dependency.
2. Write the package README and add it to the root README table (ADR-017).

## Alternatives Considered

### 1. Keep `inflected`

Standardize on the library and only add slug and truncation helpers.

**Rejected because**: the dependency's worst placement is inside a shared package, which is exactly the part that would remain. The inflection rules in use are a small, testable set.

### 2. Put Markdown Stripping In `@pkg/strings`

Implement `stripMarkdown()` as a text utility.

**Rejected because**: it would need its own markdown parser or a regular-expression approximation, while the markdown package already has a real AST. Plain-text extraction is a markdown output format.

### 3. Depend On The `title` Package

Use the npm `title` package for title casing instead of implementing Chicago rules.

**Rejected because**: it is a reasonable package and this is the closest call in this ADR. It loses on configuration rather than on quality: `special` is per call, so an app's vocabulary is either repeated at every call site or wrapped locally, while `createTitleizer()` matches the `createInflector()` shape this package already establishes. Owning the small-word lists also means the Chicago rules are visible and testable in the same place as the tests over real headings, rather than being a dependency's undocumented internals.

### 4. Global Inflection Registration

Match the replaced library's API with a mutable global rule registry.

**Rejected because**: import-order-dependent inflection results are a debugging trap, and per-inflector rules express the same intent explicitly.

## References

- [MDN: Intl.Segmenter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter)
- [Unicode Text Segmentation (UAX #29)](https://unicode.org/reports/tr29/)
- [The Chicago Manual of Style, headline-style capitalization](https://www.chicagomanualofstyle.org/book/ed17/part2/ch08/psec159.html)
- [title on npm](https://github.com/vercel/title)
- [ADR-001: New Package Extraction](./ADR-001-new-package-extraction.md)

## Current Progress

- [x] Phase 1: Inflection
- [x] Phase 2: Title Case
- [x] Phase 3: Slugs And Text Operations
- [x] Phase 4: Markdown Plain Text
- [x] Phase 5: Adoption

## Notes

- Slug parity was verified against stored content before adoption: all 69 live glossary terms reproduce their stored slug exactly, which matters because the glossary editor re-derives the slug from the term on every edit. Of 309 real post titles, five would slug differently going forward and `slugify` is the better answer in each — `parameterize` leaves a trailing dash on titles ending in `?`, preserves underscores, collapses only the first repeated-separator run, and reduces a non-Latin title to an empty string.
- `toPlainText` feeds reading-time counts and the search index, so the blog calls it with `{ fences: true, images: true }`. With the defaults, fenced code is excluded and word counts fell by up to 71% on code-heavy posts, which would have halved displayed reading times and made code identifiers unsearchable. Callers wanting an excerpt opt back out.
- The jobs package is the highest-value migration and the lowest-risk one, since it only needs `underscore` and `dasherize` over class names.
- Titleize and humanize produce English display text and should not be used for user-facing copy in localized applications; those strings belong in the i18n layer.
- `titleize()` is for authored English headings, not for text a user typed. Running it over user input rewrites what someone wrote, and a `special` list cannot know their intent.
- Test title casing against the real headings in published content rather than invented examples. Chicago's edge cases (a preposition used as an adverb, a hyphenated proper noun, a subtitle after a colon) show up in actual titles and not in the ones written to make a test pass.
