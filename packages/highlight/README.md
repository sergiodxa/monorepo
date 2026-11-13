# @sdxc/highlight

Syntax highlighting as tokens, with a markdown walk visitor and a stylesheet.

A highlighter's output is a sequence of runs, each labelled with what it is. This package
returns those runs, so a caller renders them as components, as markup or as inline styles. A
grammar is a plain value a module exports: no global registry, no import order to get right.

## Installation

```sh
npm add @sdxc/highlight
```

The root entry has no dependencies. The `./markdown` entry walks documents from
[`@sdxc/markdown`](https://www.npmjs.com/package/@sdxc/markdown), whose walk answers a `Result`
from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result).

## Usage

### Load the stylesheet

Tokens carry classes, not colours: `@sdxc/highlight/styles.css` paints them. Load it once per
page, from the document layout, after any theme stylesheet whose `--highlight-*` properties
should win:

```tsx
import "@sdxc/highlight/styles.css";
```

Or from your own CSS:

```css
@import "@sdxc/highlight/styles.css";
```

The defaults switch between a light and a dark palette by `color-scheme`, so declare the schemes
your page supports on `<html>`; a page that declares none reads the light palette.

```html
<html style="color-scheme: light dark"></html>
```

### Tokenize source

```typescript
import { tokenize } from "@sdxc/highlight";

let tokens = tokenize("let x = 1;", "ts");
// [
//   { type: "keyword", value: "let" },
//   { type: "plain", value: " x " },
//   { type: "operator", value: "=" },
//   { type: "plain", value: " " },
//   { type: "number", value: "1" },
//   { type: "punctuation", value: ";" },
// ]
```

The language is taken as an author writes it on a fence: `ts`, `sh`, `yml` or `TSX` resolve to
their grammar, and a language with no grammar comes back as one `plain` token.

### Render tokens as components

```tsx
import { tokenize } from "@sdxc/highlight";
import type { Handle } from "remix/component";
import "@sdxc/highlight/styles.css";

function CodeBlock(handle: Handle<{ code: string; language: string }>) {
	return () => {
		let { code, language } = handle.props;
		return (
			<pre>
				<code className={`language-${language}`}>
					{tokenize(code, language).map((token, index) =>
						token.type === "plain" ? (
							token.value
						) : (
							<span key={index} className={`token ${token.type}`}>
								{token.value}
							</span>
						),
					)}
				</code>
			</pre>
		);
	};
}
```

The stylesheet colours `.token.<type>` and the text of any `language-*` block.

### Render a string

```typescript
import { highlight } from "@sdxc/highlight";

let markup = highlight('let name = "x";', "ts");
// '<span class="token keyword">let</span> name <span class="token operator">=</span> …'
```

Every value is escaped, so the result is safe inside a `<pre><code>`.

### Paint a parsed document

```typescript
import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";
import { isFailure } from "@sdxc/result";

let painted = Markdown.walk(document, highlight);
if (isFailure(painted)) throw painted.error;

for (let node of painted.data.children) {
	if (node.type === "code") node.tokens; // Token[]
}
```

The walk is synchronous, so painting inside a render path needs no `await`.

## API

### `tokenize(code: string, language: string, options?: ScanOptions): Token[]`

Tokenizes source as a language, resolving aliases first. The tokens arrive in source order and
cover the input exactly once; a language with no grammar yields one `plain` token, and empty
source an empty list.

### `tokenizeLines(code: string, language: string, options?: ScanOptions): Line[]`

Tokenizes source into one entry per line, each holding the line's tokens (without its newline)
and the mode stack the line ends in. Pass a line's `state` back to scan the lines after it on
their own, such as a diff hunk or the context expanded around one:

```typescript
import { tokenizeLines } from "@sdxc/highlight";

let lines = tokenizeLines(file, "ts");
// Later, only lines 42–60, from the state line 41 ended in:
let chunk = tokenizeLines(lines42to60, "ts", { state: lines[40]?.state });
```

A chunk is scanned as its own text, so a pattern that looks behind its first line sees nothing
there: a key on the line after a `{` can paint as plain text.

### `highlight(code: string, language: string, options?: ScanOptions): string`

Highlights source into `<span class="token …">` markup, escaping every value it writes. `plain`
runs are written as escaped text without a span.

### `normalizeLanguage(language: string): string`

Lowercases a fence's language and follows an alias when one applies; an unknown name comes back
lowercased, still usable as a class name.

```typescript
normalizeLanguage("SH"); // "bash"
normalizeLanguage("txt"); // "plain"
normalizeLanguage("hcl"); // "hcl"
```

Aliases: `js`, `ts`, `py`, `rb`, `sh`, `shell`, `yml`, `gql`, `md`, `mdx`, `rest` (`http`),
`jsonc` (`json`), `xml`, `svg`, `rss`, `atom`, `mathml`, `erb` (`html`), and `text`, `txt`,
`plaintext`, `env`, `dotenv` (`plain`).

### `languages: Record<string, Grammar>`

Every bundled grammar by name: `bash`, `css`, `diff`, `graphql`, `html`, `http`, `javascript`,
`json`, `jsx`, `markdown`, `plain`, `python`, `ruby`, `sql`, `tsx`, `typescript`, `yaml`.

### `scan(code: string, grammar: Grammar, options?: ScanOptions): Token[]`

Scans source with a grammar directly, skipping the registry and aliases. Characters no rule
claims accumulate into `plain` runs, and adjacent runs of the same type arrive merged.

Each position tries only the rules whose pattern can start with the character there, in the
mode's order, and a run of characters no rule can start is taken in one step, so a scan costs
what the source is long rather than its length times the grammar's size.

### `scanLines(code: string, grammar: Grammar, options?: ScanOptions): Line[]`

`tokenizeLines` for a grammar you hold.

### `compose(...parts: Array<Record<string, Rule[]>>): Grammar`

Merges grammars mode by mode, earlier parts' rules tried first. A part without `main` merges the
same way, so a set of modes joins a grammar.

### `highlight` from `@sdxc/highlight/markdown`

A `Markdown.Visitor` with one `code` handler: it resolves the block's language (`plain` when it
names none), tokenizes the body and returns a copy of the node with the normalized `language` and
its `tokens`. `content`, `attributes` and `position` are kept, and it spreads into a visitor
alongside other handlers.

### `@sdxc/highlight/styles.css`

One rule per token type, each reading a `--highlight-<type>` custom property, plus
`--highlight-text` for the block. It sets colour only and ships light and dark defaults as
`light-dark()` pairs, resolved in the `color-scheme` of each block's element.

### Types

#### `Token`

```typescript
interface Token {
	type: Token.Type;
	value: string;
}
```

#### `Token.Type`

The closed set of twenty run kinds: `attr-name`, `attr-value`, `boolean`, `builtin`,
`class-name`, `comment`, `constant`, `deleted`, `function`, `inserted`, `keyword`, `number`,
`operator`, `plain`, `property`, `punctuation`, `regex`, `string`, `tag`, `variable`.

`builtin` covers names the language provides, `class-name` types and classes, `property` keys
of any kind, `tag` markup tag names and CSS selectors, `variable` sigil-marked names, and
`inserted`/`deleted` the sides of a diff.

#### `ScanOptions`

```typescript
interface ScanOptions {
	maxLineLength?: number; // default 2000
	state?: Line.State; // default ["main"]
}
```

`maxLineLength` is how many characters of a line the grammar reads; the rest of a longer line is
one `plain` run, so a minified file paints at once and the next line reads normally. Pass
`Infinity` to read every line in full. `state` is the mode stack to start in.

#### `Line`

```typescript
interface Line {
	tokens: Token[];
	state: Line.State; // readonly string[], innermost mode last
}
```

#### `Rule`

```typescript
interface Rule {
	type: Token.Type;
	match: RegExp;
	push?: string;
	pop?: true;
}
```

`match` carries the
[sticky flag](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/sticky)
and matches at least one character. `push` enters a mode and `pop` leaves the current one; a
rule uses one or the other.

#### `Grammar`

```typescript
interface Grammar {
	main: Rule[];
	[mode: string]: Rule[];
}
```

Scanning starts in `main`; every other entry is a mode a rule pushes.

#### `Markdown.Code["tokens"]`

The `./markdown` entry augments `@sdxc/markdown`'s code node with `tokens?: Token[]`. It is
derived data: serializing the document writes `content` and drops `tokens`.

## Pattern: Server-Rendered Code Blocks

Load the stylesheet once and emit markup for each block, with the `language-*` class the
stylesheet reads for the block's text colour.

```typescript
import { highlight, normalizeLanguage } from "@sdxc/highlight";
import "@sdxc/highlight/styles.css";

function codeBlock(code: string, language: string) {
	let name = normalizeLanguage(language);
	return `<pre><code class="language-${name}">${highlight(code, name)}</code></pre>`;
}
```

## Pattern: Paint And Rewrite In One Walk

Visitors merge, so the highlighter spreads into a visitor that also rewrites other nodes, and a
renderer reads `tokens` off each code node.

```typescript
import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";
import { isFailure } from "@sdxc/result";

let result = Markdown.walk(document, {
	...highlight,
	link(node) {
		return { ...node, href: new URL(node.href, "https://example.com").href };
	},
});
if (isFailure(result)) throw result.error;

for (let node of result.data.children) {
	if (node.type === "code") renderTokens(node.tokens ?? [], node.language);
}
```

## Pattern: Inline Colours Without A Stylesheet

An email client loads no stylesheet, so colours go inline. A palette keyed by `Token.Type` paints
the types it names and leaves the rest as text; make it a full `Record` to have the compiler
demand all twenty.

```tsx
import type { Token } from "@sdxc/highlight";
import { tokenize } from "@sdxc/highlight";

let PALETTE: Partial<Record<Token.Type, string>> = {
	comment: "#6a737d",
	keyword: "#cf222e",
	string: "#032f62",
	number: "#005cc5",
	function: "#6f42c1",
};

function paint(code: string, language: string) {
	return tokenize(code, language).map((token, index) => {
		let color = PALETTE[token.type];
		if (!color) return token.value;
		return (
			<span key={index} style={{ color }}>
				{token.value}
			</span>
		);
	});
}
```

## Pattern: Theming The Stylesheet

Declare the properties for the roles you want to change after loading the stylesheet; the rest
keep their defaults. Weight, face, padding and borders go in your own rules on the same classes.

```css
@import "@sdxc/highlight/styles.css";

:root {
	--highlight-comment: #8b949e;
	--highlight-keyword: #ff7b72;
	--highlight-string: #a5d6ff;
}

.token.comment {
	font-style: italic;
}
```

## Pattern: Writing A Grammar

A grammar is a record of modes, each a list of rules tried in order at the cursor. Anything no
rule claims becomes `plain`, so a grammar works from its first rule. Put a language the registry
lacks in front of `tokenize`:

```typescript
import type { Grammar } from "@sdxc/highlight";
import { normalizeLanguage, scan, tokenize } from "@sdxc/highlight";

let ini: Grammar = {
	main: [
		{ type: "comment", match: /[#;][^\n]*/y },
		{ type: "tag", match: /\[[^\]\n]*\]/y },
		{ type: "property", match: /[A-Za-z_][\w.]*(?=\s*=)/y },
		{ type: "operator", match: /=/y },
		{ type: "string", match: /"(?:\\[\s\S]|[^"\\\n])*"?/y },
	],
};

function highlightAny(code: string, language: string) {
	return normalizeLanguage(language) === "ini" ? scan(code, ini) : tokenize(code, language);
}
```

Rule order is priority, so a comment rule goes above an operator rule that would claim its first
character. Keep patterns linear, with no nested quantifiers over the same characters, so
highlighting costs what the block is long. A pattern that reads a word and then looks ahead,
like `[\w-]+(?=\()`, gets a `(?<![\w-])` lookbehind so a long word with no match after it is
read once, from its start.

## Pattern: Nested Modes And Composed Grammars

A region is a mode: a rule with `push` enters it and one with `pop` returns to the mode before.
A construct that nests inside itself pushes its own mode again, so the matching brace closes it.
`compose` layers these modes over an existing grammar, its rules tried first.

```typescript
import type { Rule } from "@sdxc/highlight";
import { compose, scan } from "@sdxc/highlight";

import { ini } from "./ini.js";

let expression: Rule[] = [
	{ type: "number", match: /\d+/y },
	{ type: "variable", match: /[A-Za-z_]\w*/y },
	{ type: "operator", match: /[+\-*\/]/y },
];

let templated = compose(
	{
		main: [{ type: "punctuation", match: /\$\{/y, push: "interpolation" }],
		interpolation: [
			{ type: "punctuation", match: /\}/y, pop: true },
			{ type: "punctuation", match: /\{/y, push: "interpolation" },
			...expression,
		],
	},
	ini,
);

let tokens = scan("port = ${base + 80}\n", templated);
```

## Performance

Mean time to tokenize each input, against [Prism](https://prismjs.com) 1.30 on the same
input, on one development machine. Absolute times vary between machines; the ratio is what
holds.

| Input                       | `@sdxc/highlight` | Prism 1.30 | Faster by |
| --------------------------- | ----------------: | ---------: | --------: |
| 10,000-line TypeScript file |             42 ms |     431 ms |       10× |
| 2 MB JSON document          |             40 ms |     166 ms |        4× |
| 10,000-line Markdown file   |            6.7 ms |      26 ms |        4× |
| 500 KB minified JS line     |           0.12 ms |      87 ms |      700× |

The minified line is fast because highlighting stops after `maxLineLength` (2,000 characters
by default). With `{ maxLineLength: Infinity }` the same line takes 16 ms, still 5× faster
than Prism.

Run the benchmarks from a checkout of the repository:

```sh
vp test bench --run --project packages packages/highlight/
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
		"@sdxc/highlight": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
