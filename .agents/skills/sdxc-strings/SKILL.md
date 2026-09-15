---
name: sdxc-strings
description: "@sdxc/strings does English inflection (`pluralize`, `singularize`, `camelize`, `underscore`, `dasherize`, `humanize`, `ordinalize`), Chicago-style `titleize`, `slugify`, and grapheme-safe `truncate`, `excerpt`, `wordCount`, `initials` and `capitalize`. Use when deriving a slug or a stable kebab-case identifier, casing a heading, building an excerpt or reading-time estimate, labeling a count, or cutting text without splitting an emoji."
---

# @sdxc/strings

Four jobs every product does and most codebases do twice: turning a class name into an
identifier, a title into a slug, a body into an excerpt, a field name into a label. Each has
one implementation here, so a slug written by a form matches the slug a background job
derives from the same title. Vocabulary is passed in rather than registered globally —
`createInflector()` and `createTitleizer()` bind a product's own words — and everything that
measures or cuts text goes through `Intl.Segmenter` in grapheme clusters rather than UTF-16
code units. No dependencies; runs anywhere `Intl.Segmenter` exists.

Full API, options and examples: [packages/strings/README.md](packages/strings/README.md)

## When to reach for it

- A slug typed into a form and a slug derived by a background job have to agree, or the published URL moves.
- A job name, cache key or event name should be derived from a class name once instead of written twice.
- A heading needs headline capitalization that lowercases articles and prepositions but keeps `GraphQL` and `iOS` as written.
- A label reads "1 comments", or a list summary needs an ordinal.
- An excerpt or a reading-time estimate is cutting mid-emoji, or a count is wrong in a script written without spaces.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/strings": "workspace:*" } }
```

```ts
import { excerpt, slugify, titleize } from "@sdxc/strings";

titleize("the state of javascript in 2026"); // "The State of JavaScript in 2026"
slugify("Cómo usar Remix v3"); // "como-usar-remix-v3"
excerpt(body, { length: 200 }); // one line, cut at a word boundary
```

```ts
import { dasherize, pluralize, underscore } from "@sdxc/strings";

pluralize("comment", 1); // "comment"
dasherize(underscore("SendWelcomeEmailJob")); // "send-welcome-email-job"
```

## Suggestions

- Declare product vocabulary once and export the bound function rather than repeating `special` or `irregular` at every call site: `createTitleizer({ special: [...] })` for names, `createInflector({ irregular, uncountable })` for words whose plural is not derivable. Nothing is shared between instances.
- `dasherize` preserves case, so pass camelCase or PascalCase through `underscore()` first. `humanize` is the sentence-cased label (and drops a trailing `_id`); `titleize` is the headline.
- `truncate` cuts mid-word and counts the omission marker toward `length`; `excerpt` collapses whitespace runs first and cuts at a word boundary, which is what turns multi-paragraph source text into a one-line summary.
- Adopting `slugify` on existing content is safest after checking it reproduces the stored slugs byte for byte, since published URLs move otherwise.
- Inflection and headline case are English rules. Text someone typed into a field is theirs as written, and translated copy arrives cased by its own language's conventions.

## Related

- `@sdxc/markdown` — turns a document into the plain text `excerpt` and `wordCount` measure; skill `sdxc-markdown`
