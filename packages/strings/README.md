# @pkg/strings

English inflection, Chicago-style title case, URL slugs, and grapheme-safe text operations.

## Overview

`@pkg/strings` owns the text transformations that show up all over a product:
turning a class name into a job identifier, a title into a slug, a post body into
an excerpt, a field name into a label. Each of those has exactly one
implementation here, so a slug generated in a CMS form matches the slug a
background job derives from the same title.

Two decisions shape the API. First, vocabulary is passed in rather than
registered globally: `createInflector()` and `createTitleizer()` return instances
that own their rules, so results never depend on which module imported first.
Second, anything that measures or cuts text does so through
[`Intl.Segmenter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter),
in grapheme clusters and word boundaries instead of UTF-16 code units — slicing
by code unit is what splits an emoji sequence or separates a letter from its
combining mark.

The package has no dependencies and no runtime configuration. Inflection and
headline-style capitalization are English conventions, so neither is safe to
apply to translated copy; localized strings come from the i18n layer already
cased correctly.

## Usage

### Inflection

```typescript
import { camelize, dasherize, humanize, ordinalize, pluralize, underscore } from "@pkg/strings";

pluralize("monitor"); // "monitors"
pluralize("monitor", 1); // "monitor"
camelize("cron_job_monitor"); // "cronJobMonitor"
underscore("cronJobMonitor"); // "cron_job_monitor"
dasherize(underscore("SendWelcomeEmailJob")); // "send-welcome-email-job"
humanize("cron_job_monitor"); // "Cron job monitor"
ordinalize(3); // "3rd"
```

### Domain vocabulary

```typescript
import { createInflector } from "@pkg/strings";

let inflector = createInflector({
	irregular: [["status-page", "status-pages"]],
	uncountable: ["uptime", "downtime"],
});

inflector.pluralize("status-page"); // "status-pages"
inflector.pluralize("uptime"); // "uptime"
```

### Titles, slugs, and excerpts

```typescript
import { excerpt, slugify, titleize } from "@pkg/strings";

titleize("the state of javascript in 2026"); // "The State of JavaScript in 2026"
slugify("Cómo usar Remix v3"); // "como-usar-remix-v3"
excerpt(body, { length: 200 }); // one line, cut at a word boundary
```

## API

### `pluralize(word: string, count?: number): string`

Plural form of an English word.

**Parameters:**

- `word`: Word to inflect
- `count`: Quantity the label describes; exactly `1` returns the singular form

**Returns:**

- The plural form, or the word unchanged when it is uncountable

**Example:**

```typescript
let label = `${total} ${pluralize("monitor", total)}`;
```

### `singularize(word: string): string`

Singular form of an English word, left untouched when the word is uncountable.

**Example:**

```typescript
let table = singularize("monitors"); // "monitor"
```

### `camelize(value: string, options?: CamelizeOptions): string`

camelCase form of an identifier written with underscores, dashes, or spaces.
Only the first letter of each part is touched, so an acronym an author already
cased survives.

**Parameters:**

- `value`: Identifier to convert
- `options.upperFirst`: Uppercase the first letter, producing PascalCase

**Example:**

```typescript
let field = camelize("cron_job_monitor"); // "cronJobMonitor"
let className = camelize("cron_job_monitor", { upperFirst: true }); // "CronJobMonitor"
```

### `underscore(value: string): string`

snake_case form of an identifier, splitting camelCase boundaries and folding
dashes and whitespace into underscores. An acronym stays whole:
`underscore("HTTPRequest")` is `"http_request"`.

**Example:**

```typescript
let column = underscore("createdAt"); // "created_at"
```

### `dasherize(value: string): string`

kebab-case form of an underscored identifier. Case is preserved, so pass
camelCase input through `underscore()` first.

**Example:**

```typescript
let id = dasherize(underscore("SendWelcomeEmailJob")); // "send-welcome-email-job"
```

### `humanize(value: string, options?: HumanizeOptions): string`

Sentence-cased label for an identifier: a trailing `_id` is dropped, separators
become spaces, and everything but the first letter is lowercased. Use
`titleize()` when a heading needs headline-style capitalization.

**Parameters:**

- `value`: Identifier to convert
- `options.capitalize`: Capitalize the first letter; defaults to `true`

**Example:**

```typescript
let label = humanize("monitor_id"); // "Monitor"
```

### `ordinalize(value: number): string`

Ordinal form of a number, with the teens exception (`11`, `12`, and `13` all take
`th`).

**Example:**

```typescript
let position = ordinalize(3); // "3rd"
```

### `createInflector(options?: InflectorOptions): Inflector`

Creates an inflector whose plural and singular rules include a product's own
vocabulary. Custom entries take priority over the defaults, and nothing is
shared between instances.

**Parameters:**

- `options.irregular`: `[singular, plural]` pairs whose plural is not derivable
- `options.uncountable`: Words identical in both numbers

**Returns:**

- An inflector exposing `pluralize`, `singularize`, `camelize`, `underscore`,
  `dasherize`, `humanize`, and `ordinalize`. Only the first two depend on the
  options; the rest are there so one object covers the whole surface.

**Example:**

```typescript
let inflector = createInflector({ uncountable: ["uptime", "downtime"] });
```

### `titleize(value: string, options?: TitleizeOptions): string`

Headline-style capitalization per the Chicago Manual of Style.

**Parameters:**

- `value`: Title to capitalize
- `options.special`: Words rendered exactly as written, matched
  case-insensitively; entries extend and override the built-in set

**Returns:**

- The title with each word cased per the rules below

**Example:**

```typescript
titleize("a history of the world in six glasses");
// "A History of the World in Six Glasses"

titleize("FaCEbook is great", { special: ["facebook"] });
// "facebook Is Great"
```

The rules, in the order they are applied:

| Rule                                              | Example                                            |
| ------------------------------------------------- | -------------------------------------------------- |
| A `special` entry wins over every other rule      | `special: ["iOS"]` renders `ios` as `iOS`          |
| Capitalize the first and last word, always        | `"to be continued"` to `"To Be Continued"`         |
| Capitalize the first word after a colon           | `"a history: the story"` to `"A History: The ..."` |
| Capitalize both elements of a hyphenated compound | `"self-hosted"` to `"Self-Hosted"`                 |
| Lowercase articles                                | a, an, the                                         |
| Lowercase coordinating conjunctions               | and, but, or, nor, for, so, yet                    |
| Lowercase prepositions regardless of length       | `"a walk throughout the city"`                     |
| Lowercase `as`, and `to` in an infinitive         | `"how to write"` to `"How to Write"`               |

Inside a hyphenated compound the first element is always capitalized and later
elements follow the small-word rule, so `"state-of-the-art"` becomes
`"State-of-the-Art"`.

Casing inside a word is never rewritten: only a word's first letter is adjusted,
which is why `GraphQL` survives untouched and why `iOS` needs a `special` entry
when the author typed `ios`.

### `createTitleizer(options?: TitleizeOptions): Titleizer`

Creates a titleizer bound to a vocabulary, so an app declares the names it
publishes once instead of repeating `special` at every call site.

**Example:**

```typescript
let titleize = createTitleizer({
	special: ["JavaScript", "TypeScript", "GitHub", "iOS", "npm", "Remix"],
});

titleize("getting started with remix and typescript");
// "Getting Started with Remix and TypeScript"
```

### `slugify(value: string, options?: SlugifyOptions): string`

Builds a URL-safe slug: NFKD normalization, combining marks removed,
lowercased, every non-alphanumeric run collapsed into the separator, and the
separator trimmed from both ends. Letters outside Latin are kept as letters
rather than dropped, so a non-Latin title still yields a usable slug.

**Parameters:**

- `value`: Text to slugify
- `options.separator`: String joining the words; defaults to `"-"`, and `""`
  joins them with nothing

**Returns:**

- The slug, or an empty string when the input holds no letters or digits

**Example:**

```typescript
slugify("Cómo usar Remix v3"); // "como-usar-remix-v3"
slugify("Hello, World!", { separator: "_" }); // "hello_world"
```

### `truncate(text: string, options: TruncateOptions): string`

Truncates text to a maximum number of grapheme clusters, appending the omission
marker only when something was cut. The marker counts towards the limit, so the
result never exceeds `length` clusters.

**Parameters:**

- `text`: Text to truncate
- `options.length`: Maximum number of grapheme clusters, omission included
- `options.words`: Cut at a word boundary instead of mid-word; defaults to `false`
- `options.omission`: Marker appended when text was cut; defaults to `"…"`
- `options.locale`: Locale driving segmentation

**Example:**

```typescript
truncate(text, { length: 140 }); // never splits a grapheme cluster
truncate(text, { length: 140, words: true }); // never splits a word either
```

### `excerpt(text: string, options: ExcerptOptions): string`

Collapses every run of whitespace into a single space and then truncates, which
turns multi-paragraph source text into a one-line summary. Unlike `truncate()` it
cuts at a word boundary by default.

**Example:**

```typescript
let summary = excerpt(body, { length: 200 });
```

### `wordCount(text: string, options?: LocaleOptions): number`

Counts words through word-boundary segmentation rather than by splitting on
spaces, so scripts written without spaces still get a count and an emoji is not
counted as a word.

**Example:**

```typescript
let minutes = Math.ceil(wordCount(body) / 200);
```

### `initials(name: string, options?: InitialsOptions): string`

Builds initials by taking the first grapheme cluster of each word, uppercased.

**Parameters:**

- `name`: Name to reduce to initials
- `options.limit`: How many initials to keep; defaults to `2`, the avatar case
- `options.locale`: Locale driving segmentation

**Example:**

```typescript
initials("Sergio Xalambrí"); // "SX"
initials("Ada Byron King", { limit: 3 }); // "ABK"
```

### `capitalize(value: string, options?: LocaleOptions): string`

Uppercases the first grapheme cluster and leaves the rest untouched, so an
acronym or an intentionally cased word keeps the casing its author chose.

**Example:**

```typescript
capitalize("remix"); // "Remix"
```

### Types

#### `InflectorOptions`

```typescript
interface InflectorOptions {
	irregular?: ReadonlyArray<IrregularPair>;
	uncountable?: ReadonlyArray<string>;
}

type IrregularPair = readonly [singular: string, plural: string];
```

#### `TitleizeOptions`

```typescript
interface TitleizeOptions {
	special?: ReadonlyArray<string>;
}
```

#### `SlugifyOptions`

```typescript
interface SlugifyOptions {
	separator?: string;
}
```

#### `TruncateOptions`

```typescript
interface TruncateOptions {
	length: number;
	words?: boolean;
	omission?: string;
	locale?: Intl.LocalesArgument;
}
```

## Pattern: Deriving A Stable Identifier

Job names, cache keys, and event names read better as kebab-case and must be
stable across deploys, so derive them from a class name once instead of writing
the string twice.

```typescript
import { dasherize, underscore } from "@pkg/strings";

function identifierFor(name: string) {
	return dasherize(underscore(name));
}

identifierFor("SendWelcomeEmailJob"); // "send-welcome-email-job"
```

## Pattern: One Slug Implementation, Two Call Sites

A slug typed into a CMS form and a slug derived by a job must agree, or the
published URL moves. Call the same function in both places and never normalize by
hand.

```typescript
import { slugify } from "@pkg/strings";

let slug = input.slug ? slugify(input.slug) : slugify(input.title);
```

Existing slugs are not regenerated, so verify this produces byte-identical output
for stored content before switching a call site over: a changed slug breaks a
published URL.

## Pattern: An Excerpt From A Markdown Body

Plain-text extraction is a markdown concern, so it lives with the parser; this
package handles the text once it is plain.

```typescript
import { toPlainText } from "@pkg/markdown";
import { excerpt, wordCount } from "@pkg/strings";

let text = toPlainText(body);
let summary = excerpt(text, { length: 200 });
let minutes = Math.ceil(wordCount(text) / 200);
```

## Pattern: An App's Published Vocabulary

Declare the names an app publishes in one module and export the bound titleizer,
so a heading is cased the same way on every page.

```typescript
// app/utils/titles.ts
import { createTitleizer } from "@pkg/strings";

export let titleize = createTitleizer({
	special: ["JavaScript", "TypeScript", "GitHub", "iOS", "npm", "Remix", "SQLite"],
});
```

## Related Packages

- [`@pkg/markdown`](/packages/markdown) - `toPlainText()` for markdown bodies, which composes with `excerpt()` and `wordCount()`
- [`@pkg/i18n`](/packages/i18n) - translated copy, which is already cased correctly and must not be run through `titleize()` or `humanize()`

## Tips

1. **Titleize authored headings, not user input** - running it over text someone typed rewrites what they wrote, and a `special` list cannot know their intent.
2. **Check the headings that matter** - whether a word is a preposition or an adverb depends on the sentence (`"turn on the light"` versus `"log on time"`), and a word-list implementation cannot tell the difference.
3. **Extend `special` instead of fighting a rule** - an entry beats every other rule, including the small-word list, and renders exactly as written.
4. **Keep vocabulary in the app that publishes it** - the built-in `special` set covers names whose casing is not derivable at all; product terms belong in a `createTitleizer()` call.
5. **Prefer `humanize()` for labels and `titleize()` for headings** - sentence case is what a form label or a table header wants.
6. **`Intl.Segmenter` is slower than slicing** - irrelevant per request, worth remembering in a loop over thousands of records.
7. **Verify slug parity before adoption** - a stored slug that changes shape breaks a published URL.
8. **Neither inflection nor title case is localizable** - both are English-specific by nature, so keep them off translated copy.
