# @sdxc/strings

English inflection, Chicago title case, slugs and grapheme-safe text.

One implementation each for turning a class name into an identifier, a title into a slug, a
body into an excerpt and a field name into a label. Vocabulary is passed per instance, and
everything that measures or cuts text counts in grapheme clusters through
[`Intl.Segmenter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter),
so an emoji or an accented letter is never split.

## Installation

```sh
npm add @sdxc/strings
```

## Usage

### Inflect English words and identifiers

```typescript
import { camelize, dasherize, humanize, ordinalize, pluralize, underscore } from "@sdxc/strings";

pluralize("comment"); // "comments"
pluralize("comment", 1); // "comment"
camelize("blog_post_draft"); // "blogPostDraft"
underscore("createdAt"); // "created_at"
dasherize("blog_post_draft"); // "blog-post-draft"
humanize("author_id"); // "Author"
ordinalize(3); // "3rd"
```

### Title-case headings and build slugs

```typescript
import { slugify, titleize } from "@sdxc/strings";

titleize("the state of javascript in 2026"); // "The State of JavaScript in 2026"
slugify("Cómo usar Remix v3"); // "como-usar-remix-v3"
```

### Cut and measure text in graphemes

```typescript
import { capitalize, excerpt, initials, truncate, wordCount } from "@sdxc/strings";

truncate("a long sentence", { length: 10 }); // "a long se…"
truncate("a long sentence", { length: 10, words: true }); // "a long…"
excerpt("First paragraph.\n\nSecond one.", { length: 20 }); // "First paragraph.…"
wordCount("Hello, world!"); // 2
initials("Ada Lovelace"); // "AL"
capitalize("remix"); // "Remix"
```

### Add your own vocabulary

```typescript
import { createInflector, createTitleizer } from "@sdxc/strings";

let inflector = createInflector({ irregular: [["cactus", "cacti"]], uncountable: ["feedback"] });
inflector.pluralize("cactus"); // "cacti"
inflector.pluralize("feedback"); // "feedback"

let titleize = createTitleizer({ special: ["Remix"] });
titleize("getting started with remix"); // "Getting Started with Remix"
```

## API

### `pluralize(word: string, count?: number): string`

Plural form of an English word, or the singular form when `count` is exactly `1`, so one call
site labels both cases. An uncountable word comes back unchanged.

### `singularize(word: string): string`

Singular form of an English word: `singularize("people")` is `"person"`.

### `camelize(value: string, options?: CamelizeOptions): string`

camelCase form of an identifier written with underscores, dashes or spaces; `upperFirst: true`
produces PascalCase. Only the first letter of each part changes, so an acronym keeps its casing.

### `underscore(value: string): string`

snake_case form of an identifier, splitting camelCase boundaries and keeping acronyms whole:
`underscore("HTTPRequest")` is `"http_request"`.

### `dasherize(value: string): string`

kebab-case form of an underscored identifier. It keeps the case of its input, so pass camelCase
through `underscore()` first.

### `humanize(value: string, options?: HumanizeOptions): string`

Sentence-cased label for an identifier: a trailing `_id` is dropped, separators become spaces,
and only the first letter is uppercased (`capitalize: false` keeps it lowercase).
`humanize("blogPostDraft")` is `"Blog post draft"`.

### `ordinalize(value: number): string`

The number with its English ordinal suffix, where `11`, `12` and `13` all take `th`:
`ordinalize(112)` is `"112th"`.

### `createInflector(options?: InflectorOptions): Inflector`

An inflector whose `pluralize` and `singularize` include your irregular pairs and uncountable
words, ahead of the English defaults. It also carries `camelize`, `underscore`, `dasherize`,
`humanize` and `ordinalize`, and each instance keeps its own vocabulary.

### `titleize(value: string, options?: TitleizeOptions): string`

Headline-style capitalization following the
[Chicago Manual of Style](https://www.chicagomanualofstyle.org), applied in this order:

| Rule                                              | Example                                     |
| ------------------------------------------------- | ------------------------------------------- |
| A `special` entry is rendered exactly as written  | `special: ["iOS"]` renders `ios` as `iOS`   |
| The first and last word are capitalized           | `"to be continued"` → `"To Be Continued"`   |
| The word after a colon is capitalized             | `"a history: the story"` → `"…: The Story"` |
| Each element of a hyphenated compound follows     | `"state-of-the-art"` → `"State-of-the-Art"` |
| Articles and coordinating conjunctions lowercase  | a, an, the, and, but, or, nor, for, so, yet |
| Prepositions of any length, `as`, infinitive `to` | `"how to write"` → `"How to Write"`         |

Only a word's first letter is adjusted, so `GraphQL` survives as typed. A built-in `special`
set covers names such as `API`, `GitHub`, `iOS`, `JavaScript`, `macOS`, `npm` and `TypeScript`;
your entries extend and override it.

### `createTitleizer(options?: TitleizeOptions): Titleizer`

A `titleize` bound to a `special` vocabulary, so the names a product publishes are declared once.

### `slugify(value: string, options?: SlugifyOptions): string`

A lowercase URL slug joined by `separator` (default `"-"`, `""` joins with nothing), or `""`
when the input holds no letters or digits. Non-Latin letters stay letters. It stands in for:

```typescript
value
	.normalize("NFKD")
	.replace(/\p{M}+/gu, "")
	.toLowerCase()
	.replace(/[^\p{L}\p{N}]+/gu, "-"); // then trim "-" from both ends
```

### `truncate(text: string, options: TruncateOptions): string`

Cuts text to at most `length` grapheme clusters, the omission marker included, and appends the
marker only when something was cut. `words: true` cuts at a word boundary.

### `excerpt(text: string, options: ExcerptOptions): string`

Collapses every whitespace run into one space, then truncates at a word boundary, turning
multi-paragraph text into a one-line summary.

### `wordCount(text: string, options?: LocaleOptions): number`

Counts words by word-boundary segmentation, so a script written without spaces gets a count
and punctuation or emoji stay out of the total.

### `initials(name: string, options?: InitialsOptions): string`

The uppercased first grapheme of each word, keeping `limit` of them (default `2`):
`initials("Ada Byron King", { limit: 3 })` is `"ABK"`.

### `capitalize(value: string, options?: LocaleOptions): string`

Uppercases the first grapheme cluster and leaves the rest as written.

### Types

```typescript
type IrregularPair = readonly [singular: string, plural: string];

interface InflectorOptions {
	irregular?: ReadonlyArray<IrregularPair>;
	uncountable?: ReadonlyArray<string>;
}

interface CamelizeOptions {
	upperFirst?: boolean; // PascalCase
}

interface HumanizeOptions {
	capitalize?: boolean; // default true
}

interface TitleizeOptions {
	special?: ReadonlyArray<string>; // matched case-insensitively
}

interface SlugifyOptions {
	separator?: string; // default "-"
}

interface LocaleOptions {
	locale?: Intl.LocalesArgument; // default: the runtime's locale
}

interface TruncateOptions extends LocaleOptions {
	length: number; // grapheme clusters, omission included
	words?: boolean; // default false
	omission?: string; // default "…"
}

interface ExcerptOptions extends LocaleOptions {
	length: number;
	words?: boolean; // default true
	omission?: string; // default "…"
}

interface InitialsOptions extends LocaleOptions {
	limit?: number; // default 2
}
```

`Inflector` is the object `createInflector()` returns, and `Titleizer` is the
`(value: string) => string` function `createTitleizer()` returns.

## Pattern: Stable Identifiers From Class Names

Job names, cache keys and event names stay stable across deploys when they are derived from the
class name instead of written twice.

```typescript
import { camelize, dasherize, underscore } from "@sdxc/strings";

function jobName(className: string) {
	return dasherize(underscore(className));
}

jobName("SendWelcomeEmailJob"); // "send-welcome-email-job"
camelize("send_welcome_email_job", { upperFirst: true }); // "SendWelcomeEmailJob"
```

## Pattern: One Slug For Forms And Jobs

A slug typed into a form and a slug a background job derives from the title agree when both go
through `slugify()`.

```typescript
import { slugify } from "@sdxc/strings";

interface PostInput {
	title: string;
	slug?: string;
}

function slugFor(input: PostInput) {
	return slugify(input.slug || input.title);
}

slugFor({ title: "Hello, World!" }); // "hello-world"
slugFor({ title: "Hello", slug: "Mi Primer Artículo" }); // "mi-primer-articulo"
```

When slugs are already stored, check that `slugify()` reproduces them before switching, or the
published URLs move.

## Pattern: Labels From Counts And Field Names

Form labels, table headers and counters come from the data's own names.

```typescript
import { humanize, ordinalize, pluralize } from "@sdxc/strings";

function countLabel(total: number, noun: string) {
	return `${total} ${pluralize(noun, total)}`;
}

countLabel(1, "reply"); // "1 reply"
countLabel(3, "reply"); // "3 replies"

let headers = ["author_id", "published_at"].map((field) => humanize(field)); // ["Author", "Published at"]
let place = `${ordinalize(2)} place`; // "2nd place"
```

## Pattern: An Excerpt And Reading Time From Markdown

[`@sdxc/markdown`](https://www.npmjs.com/package/@sdxc/markdown) turns a document into plain
text; this package summarizes and measures it.

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

Declare a product's names and nouns in one module and import the bound functions everywhere, so
every heading and label is inflected the same way.

```typescript
import { createInflector, createTitleizer } from "@sdxc/strings";

export let titleize = createTitleizer({ special: ["Remix", "SQLite", "WebSocket"] });
export let inflector = createInflector({
	irregular: [["status-page", "status-pages"]],
	uncountable: ["feedback", "metadata"],
});

titleize("syncing sqlite over a websocket"); // "Syncing SQLite over a WebSocket"
inflector.pluralize("feedback", 4); // "feedback"
```

Headline case and inflection are English rules: apply them to headings an author writes, and
leave user input and translated copy as written.

## Pattern: Avatars And Previews In Any Script

Names and previews are cut in graphemes, so emoji and combining marks stay whole; pass `locale`
when the text's language segments differently from the runtime's default.

```typescript
import { initials, truncate, wordCount } from "@sdxc/strings";

initials("Zoë Ångström"); // "ZÅ"
truncate("Ship it 🚀🚀🚀 today", { length: 10 }); // "Ship it 🚀…"
truncate("Ship it today", { length: 12, omission: " [more]" }); // "Ship [more]"
wordCount("東京は晴れです", { locale: "ja" }); // counts words without spaces
```

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
