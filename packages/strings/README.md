# @sdxc/strings

English inflection, Chicago title case, slugs and grapheme-safe text.

Four jobs every product does and most codebases do twice: turning a class name into an
identifier, a title into a slug, a body into an excerpt, a field name into a label. Each has
one implementation here, so a slug written by a form matches the slug a background job
derives from the same title.

Vocabulary is passed in rather than registered globally, and anything that measures or cuts
text goes through
[`Intl.Segmenter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter)
in graphemes rather than UTF-16 code units.

## Installation

```bash
npm add @sdxc/strings
```

Building an excerpt out of a markdown body pairs it with
[`@sdxc/markdown`](https://www.npmjs.com/package/@sdxc/markdown), which turns a document
into the plain text these helpers measure.

## Usage

### Inflection

```typescript
import { camelize, dasherize, humanize, ordinalize, pluralize, underscore } from "@sdxc/strings";

pluralize("comment"); // "comments"
pluralize("comment", 1); // "comment"
camelize("blog_post_draft"); // "blogPostDraft"
underscore("createdAt"); // "created_at"
dasherize(underscore("SendWelcomeEmailJob")); // "send-welcome-email-job"
humanize("author_id"); // "Author"
ordinalize(3); // "3rd"
```

### Titles, Slugs And Excerpts

```typescript
import { excerpt, slugify, titleize } from "@sdxc/strings";

titleize("the state of javascript in 2026"); // "The State of JavaScript in 2026"
slugify("Cómo usar Remix v3"); // "como-usar-remix-v3"
excerpt(body, { length: 200 }); // one line, cut at a word boundary
```

### Grapheme-Safe Measurement

```typescript
import { initials, truncate, wordCount } from "@sdxc/strings";

truncate("a long sentence", { length: 10 }); // "a long se…"
truncate("a long sentence", { length: 10, words: true }); // "a long…"
initials("Ada Lovelace"); // "AL"
wordCount("Hello, world!"); // 2
```

`wordCount` stands in for the segmentation loop, which is what makes a count work in a
script written without spaces and keeps an emoji out of the total:

```typescript
let segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
let total = 0;
for (let { isWordLike } of segmenter.segment(text)) if (isWordLike) total += 1;
```

### A Product's Own Vocabulary

```typescript
import { createInflector } from "@sdxc/strings";

let inflector = createInflector({
	irregular: [["status-page", "status-pages"]],
	uncountable: ["feedback"],
});

inflector.pluralize("status-page"); // "status-pages"
inflector.pluralize("feedback"); // "feedback"
```

## API

### `pluralize(word: string, count?: number): string`

Plural form of an English word, returning the singular form when `count` is exactly `1`, so
one call site labels both cases. An uncountable word comes back unchanged.

```typescript
let label = `${total} ${pluralize("comment", total)}`;
```

### `singularize(word: string): string`

Singular form of an English word, left untouched when the word is uncountable.
`singularize("categories")` is `"category"` and `singularize("people")` is `"person"`.

### `camelize(value: string, options?: CamelizeOptions): string`

camelCase form of an identifier written with underscores, dashes or spaces. Only the first
letter of each part is touched, so an acronym an author already cased survives.

```typescript
let field = camelize("blog_post_draft"); // "blogPostDraft"
let className = camelize("blog_post_draft", { upperFirst: true }); // "BlogPostDraft"
```

### `underscore(value: string): string`

snake_case form of an identifier, splitting camelCase boundaries and folding dashes and
whitespace into underscores. An acronym stays whole: `underscore("HTTPRequest")` is
`"http_request"`.

### `dasherize(value: string): string`

kebab-case form of an underscored identifier, replacing underscores and whitespace with
dashes. Case is preserved, so pass camelCase input through `underscore()` first.

```typescript
let id = dasherize(underscore("SendWelcomeEmailJob")); // "send-welcome-email-job"
```

### `humanize(value: string, options?: HumanizeOptions): string`

Sentence-cased label for an identifier: a trailing `_id` is dropped, separators become
spaces, and everything but the first letter is lowercased. Reach for `titleize()` when a
heading needs headline-style capitalization instead.

```typescript
humanize("author_id"); // "Author"
humanize("blog_post_draft"); // "Blog post draft"
humanize("blogPostDraft", { capitalize: false }); // "blog post draft"
```

### `ordinalize(value: number): string`

Ordinal form of a number, with the teens exception that makes `11`, `12` and `13` all take
`th` — the arithmetic it stands in for:

```typescript
let mod100 = Math.abs(value) % 100;
let suffix =
	mod100 >= 11 && mod100 <= 13 ? "th" : (["th", "st", "nd", "rd"][Math.abs(value) % 10] ?? "th");

ordinalize(3); // "3rd"
ordinalize(112); // "112th"
```

### `createInflector(options?: InflectorOptions): Inflector`

Creates an inflector whose plural and singular rules include a product's own vocabulary.
Custom entries take priority over the English defaults and nothing is shared between
instances, so two inflectors in one process stay independent.

The returned object exposes `pluralize`, `singularize`, `camelize`, `underscore`,
`dasherize`, `humanize` and `ordinalize`. The first two read the options; the rest are there
so one object covers the whole surface.

```typescript
let inflector = createInflector({ uncountable: ["feedback"] });
inflector.pluralize("feedback"); // "feedback"
```

### `titleize(value: string, options?: TitleizeOptions): string`

Headline-style capitalization following the
[Chicago Manual of Style](https://www.chicagomanualofstyle.org).

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

Inside a hyphenated compound the first element is always capitalized and later elements
follow the small-word rule, so `"state-of-the-art"` becomes `"State-of-the-Art"`.

Casing inside a word is left as the author typed it — only a word's first letter is
adjusted, which is why `GraphQL` survives untouched and why a lowercase `graphql` needs a
`special` entry to come back as `GraphQL`.

A built-in `special` set covers names whose casing cannot be derived at all: `API`, `CSS`,
`GitHub`, `HTTP`, `iOS`, `JavaScript`, `macOS`, `Node.js`, `npm`, `OAuth`, `PostgreSQL`,
`SQLite`, `TypeScript`, `URL`, `YAML` and a few dozen more. Product vocabulary goes in a
`createTitleizer()` call.

### `createTitleizer(options?: TitleizeOptions): Titleizer`

Creates a titleizer bound to a vocabulary, so a product declares the names it publishes
once instead of repeating `special` at every call site.

```typescript
let titleize = createTitleizer({
	special: ["JavaScript", "TypeScript", "GitHub", "iOS", "npm", "Remix"],
});

titleize("getting started with remix and typescript");
// "Getting Started with Remix and TypeScript"
```

### `slugify(value: string, options?: SlugifyOptions): string`

Builds a URL-safe slug, returning an empty string when the input holds no letters or
digits. Letters outside Latin are kept as letters rather than dropped, so a non-Latin title
still yields a usable slug.

```typescript
slugify("Cómo usar Remix v3"); // "como-usar-remix-v3"
slugify("Hello, World!", { separator: "_" }); // "hello_world"
slugify("Hello, World!", { separator: "" }); // "helloworld"
```

The normalization it stands in for, plus trimming the separator from both ends:

```typescript
value
	.normalize("NFKD")
	.replace(/\p{M}+/gu, "")
	.toLowerCase()
	.replace(/[^\p{L}\p{N}]+/gu, "-");
```

NFKD splits an accented letter into a base letter and a combining mark, and removing the
marks folds `ó` onto `o` without a transliteration table.

### `truncate(text: string, options: TruncateOptions): string`

Truncates text to a maximum number of grapheme clusters, appending the omission marker only
when something was cut. The marker counts towards the limit, so the result never exceeds
`length` clusters, and a cut lands between clusters rather than inside one.

```typescript
truncate("a long sentence", { length: 10 }); // "a long se…"
truncate("a long sentence", { length: 10, words: true }); // "a long…"
truncate("short", { length: 10 }); // "short"
```

### `excerpt(text: string, options: ExcerptOptions): string`

Collapses every run of whitespace into a single space and then truncates, which turns
multi-paragraph source text into a one-line summary. It cuts at a word boundary by default,
where `truncate()` cuts mid-word.

```typescript
let summary = excerpt(body, { length: 200 });
```

### `wordCount(text: string, options?: LocaleOptions): number`

Counts words through word-boundary segmentation, so a script written without spaces gets a
count and an emoji stays out of the total.

```typescript
let minutes = Math.ceil(wordCount(body) / 200);
```

### `initials(name: string, options?: InitialsOptions): string`

Builds initials by taking the first grapheme cluster of each word, uppercased. `limit`
defaults to `2`, the avatar case.

```typescript
initials("Ada Lovelace"); // "AL"
initials("Ada Byron King", { limit: 3 }); // "ABK"
```

### `capitalize(value: string, options?: LocaleOptions): string`

Uppercases the first grapheme cluster and leaves the rest as written, so an acronym or an
intentionally cased word keeps the casing its author chose. Taking the first cluster rather
than `value[0]` keeps an emoji or a combining mark whole.

```typescript
capitalize("remix"); // "Remix"
```

### Types

```typescript
interface CamelizeOptions {
	/** Uppercase the first letter, producing PascalCase. */
	upperFirst?: boolean;
}

interface HumanizeOptions {
	/** Capitalize the first letter. Defaults to `true`. */
	capitalize?: boolean;
}

type IrregularPair = readonly [singular: string, plural: string];

interface InflectorOptions {
	/** Pairs whose plural is not derivable, e.g. `["person", "people"]`. */
	irregular?: ReadonlyArray<IrregularPair>;
	/** Words identical in both numbers. */
	uncountable?: ReadonlyArray<string>;
}

interface TitleizeOptions {
	/** Words rendered exactly as written, matched case-insensitively. */
	special?: ReadonlyArray<string>;
}

interface SlugifyOptions {
	/** String joining the words, also trimmed from both ends. Defaults to `"-"`. */
	separator?: string;
}

interface LocaleOptions {
	/** Locale driving segmentation; defaults to the runtime's default locale. */
	locale?: Intl.LocalesArgument;
}

interface TruncateOptions extends LocaleOptions {
	/** Maximum number of grapheme clusters, omission included. */
	length: number;
	/** Cut at a word boundary instead of mid-word. Defaults to `false`. */
	words?: boolean;
	/** Marker appended when the text was cut. Defaults to `"…"`. */
	omission?: string;
}

/** The same fields as `TruncateOptions`, with `words` defaulting to `true`. */
interface ExcerptOptions extends LocaleOptions {
	length: number;
	words?: boolean;
	omission?: string;
}

interface InitialsOptions extends LocaleOptions {
	/** How many initials to keep. Defaults to `2`. */
	limit?: number;
}
```

`Inflector` is the object `createInflector()` returns, and `Titleizer` is the
`(value: string) => string` function `createTitleizer()` returns.

## Pattern: Deriving A Stable Identifier

Job names, cache keys and event names read better as kebab-case and must stay stable across
deploys, so derive them from a class name once instead of writing the string twice.

```typescript
import { dasherize, underscore } from "@sdxc/strings";

function identifierFor(name: string) {
	return dasherize(underscore(name));
}

identifierFor("SendWelcomeEmailJob"); // "send-welcome-email-job"
```

## Pattern: One Slug Implementation, Two Call Sites

A slug typed into a form and a slug derived by a background job must agree, or the published
URL moves. Call the same function in both places and let it own the normalization.

```typescript
import { slugify } from "@sdxc/strings";

let slug = input.slug ? slugify(input.slug) : slugify(input.title);
```

Slugs already stored keep whatever shape they were saved with, so adopting this on existing
content is safest after checking that `slugify()` reproduces those stored values byte for
byte.

## Pattern: An Excerpt From A Markdown Body

Extracting prose from markdown is the parser's job; this package takes over once the text is
plain.

```typescript
import { Markdown } from "@sdxc/markdown";
import { toPlainText } from "@sdxc/markdown/plain";
import { isFailure } from "@sdxc/result";
import { excerpt, wordCount } from "@sdxc/strings";

let parsed = Markdown.parse(source);
if (isFailure(parsed)) throw parsed.error;

let text = toPlainText(parsed.data.document);
let summary = excerpt(text, { length: 200 });
let minutes = Math.ceil(wordCount(text) / 200);
```

## Pattern: A Product's Published Vocabulary

Declare the names a product publishes in one module and export the bound titleizer, so a
heading is cased the same way on every page.

```typescript
import { createTitleizer } from "@sdxc/strings";

export let titleize = createTitleizer({
	special: ["JavaScript", "TypeScript", "GitHub", "iOS", "npm", "Remix", "SQLite"],
});
```

Headings an author writes are the input this is for. Text someone typed into a field is
theirs as written, and translated copy arrives cased by the conventions of its own
language — inflection and headline case are both English rules.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/strings": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
