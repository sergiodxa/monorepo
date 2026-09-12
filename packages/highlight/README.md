# @sdxc/highlight

Syntax highlighting that returns tokens rather than markup, with a markdown walk visitor and
a stylesheet keyed to the token types.

A highlighter's real output is a sequence of runs, each labelled with what it is. Markup is
one way to render that, and the wrong way when the renderer builds a component tree, so this
package returns the tokens and a caller renders them however it renders anything else. A
grammar is a plain value a module exports: no global registry, no import order to get right.

## Installation

```bash
npm add @sdxc/highlight
```

The root entry has no dependencies. `@sdxc/highlight/markdown` walks a document from
[`@sdxc/markdown`](https://www.npmjs.com/package/@sdxc/markdown), whose walk reports its
outcome as a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result);
both install alongside this package when you use that entry.

## Usage

### Tokenize Source

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

The language arrives as an author wrote it on a fence, so `tokenize` resolves aliases itself
— `ts`, `js`, `sh`, `yml`, `jsonc` and `gql` land on the grammar that serves them, and
`text`, `txt` and `dotenv` land on `plain`.

### Render Tokens

Map them. Nothing about a token needs interpreting:

```tsx
<code className={`language-${language}`}>
	{tokens.map((token, index) =>
		token.type === "plain" ? (
			token.value
		) : (
			<span key={index} className={`token ${token.type}`}>
				{token.value}
			</span>
		),
	)}
</code>
```

### Render Markup

When a caller needs a string rather than elements:

```typescript
import { highlight } from "@sdxc/highlight";

let markup = highlight('let name = "x";', "ts");
// '<span class="token keyword">let</span> name <span class="token operator">=</span> …'
```

Every value is escaped, `plain` included, so the result is safe inside a `<pre><code>`.

### Paint A Parsed Document

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

Every handler this visitor holds is synchronous, so the walk answers with a `Result` rather
than a promise, and a painting pass inside a render path is never awaited.

## API

### `tokenize(code: string, language: string): Token[]`

Tokenizes source as a language, resolving aliases first. The tokens arrive in source order
and cover the input exactly once. A language with no grammar yields one `plain` token
holding the whole input, and empty source yields an empty list.

```typescript
let tokens = tokenize("SELECT 1", "sql");
let covered = tokens.map((token) => token.value).join("") === "SELECT 1"; // always true
```

### `highlight(code: string, language: string): string`

Highlights source into `<span class="token …">` markup, escaping every value it writes.
This is the form for callers that need a string; a caller rendering components maps
`tokenize` instead.

```typescript
highlight("<b>&</b>", "hcl"); // "&lt;b&gt;&amp;&lt;/b&gt;"
```

### `normalizeLanguage(language: string): string`

Resolves what a fence wrote to the name a grammar answers to, lowercasing it and following
an alias when one applies. The result is a name to display and to look up, not a promise
that a grammar exists.

```typescript
normalizeLanguage("SH"); // "bash"
normalizeLanguage("txt"); // "plain"
normalizeLanguage("hcl"); // "hcl" — no grammar, and still a usable class name
```

### `languages: Record<string, Grammar>`

Every grammar, by the name it registers under: `bash`, `css`, `diff`, `graphql`, `html`,
`http`, `javascript`, `json`, `jsx`, `markdown`, `plain`, `python`, `ruby`, `sql`, `tsx`,
`typescript`, `yaml`. `html` also serves the `xml`, `svg`, `rss`, `atom`, `mathml` and `erb`
aliases, since it is general markup rather than a list of known element names.

```typescript
Object.hasOwn(languages, normalizeLanguage("toml")); // false
```

### `scan(code: string, grammar: Grammar): Token[]`

Scans source with a grammar directly, skipping the registry and the alias table. Adjacent
runs of the same type arrive merged, so the output is the same whether a grammar spells a
construct as one rule or several.

```typescript
import { scan } from "@sdxc/highlight";

import { ini } from "./ini.js";

let tokens = scan("[server]\nport = 8080\n", ini);
```

### `compose(...parts: Array<Record<string, Rule[]>>): Grammar`

Merges grammars into one, mode by mode, so a language built on another states that as an
import. The earlier part's rules are tried first, which is how a JSX tag wins over a
TypeScript comparison on the same `<`. A part with no `main` of its own merges the same way,
which is how a set of modes lifted off another grammar joins one.

```typescript
import { compose } from "@sdxc/highlight";

export let tsx = compose(elements, typescript);
```

### `highlight` (from `@sdxc/highlight/markdown`)

A `Markdown.Visitor` holding one `code` handler, so a document paints in the pass that walks
it. The handler resolves the language the block names, tokenizes its body, and returns a
copy of the node carrying both; a block that names no language, as an indented block never
does, is painted as `plain`. The node keeps its `content`, `attributes` and `position`, and
visitors merge, so one walk paints and rewrites at once.

```typescript
import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";

let result = Markdown.walk(document, {
	...highlight,
	link(node) {
		return { ...node, href: canonical(node.href) };
	},
});
```

### `@sdxc/highlight/styles.css`

The selector layer: one rule per token type, each reading a custom property named
`--highlight-<type>`. It sets colour and nothing else, and ships light and dark defaults, so
loading it alone already paints.

```typescript
import "@sdxc/highlight/styles.css";
```

### Types

#### `Token`

```typescript
interface Token {
	type: Token.Type;
	value: string;
}
```

#### `Token.Type`

The twenty kinds of run a grammar can name:

`attr-name`, `attr-value`, `boolean`, `builtin`, `class-name`, `comment`, `constant`,
`deleted`, `function`, `inserted`, `keyword`, `number`, `operator`, `plain`, `property`,
`punctuation`, `regex`, `string`, `tag`, `variable`.

`builtin` is for names the language itself provides, `class-name` for types and classes,
`property` for a key of any kind, `tag` for a markup tag name and a CSS selector, `variable`
for a sigil-marked name, `inserted` and `deleted` for the two sides of a diff, and `plain`
for everything no rule claimed.

#### `Rule`

```typescript
interface Rule {
	type: Token.Type;
	match: RegExp;
	push?: string;
	pop?: true;
}
```

`match` carries the [sticky
flag](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/sticky),
so it matches where the scanner is rather than searching ahead. `push` and `pop` move the
mode stack, and a rule uses one or the other.

#### `Grammar`

```typescript
interface Grammar {
	main: Rule[];
	[mode: string]: Rule[];
}
```

`main` is where scanning starts. Every other entry is a context a rule pushes onto the stack
— a template literal's interpolation, a markup tag's attributes, the body of an embedded
language.

#### `Markdown.Code["tokens"]`

```typescript
declare module "@sdxc/markdown" {
	namespace Markdown {
		interface Code {
			tokens?: Token[];
		}
	}
}
```

The field `@sdxc/highlight/markdown` declares and fills: the runs of the block's body, in
source order, covering its `content` exactly once. It is optional because a document that no
walk painted has none, and it is derived data — a serializer writes the fields a parser
produced, so `tokens` survives a round trip through the document and not through the text.

## Pattern: Painting Tokens Without A Stylesheet

An email client has no stylesheet to load, so the colour has to be inline. Key the palette by
the type union and the compiler checks it covers every member, which is what keeps a type
added upstream from silently rendering unpainted:

```tsx
import type { Token } from "@sdxc/highlight";

const COLORS: Record<Token.Type, string | undefined> = {
	comment: "#6a737d",
	keyword: "#d73a49",
	string: "#032f62",
	// …
	plain: undefined,
};

function paint(tokens: Token[]) {
	return tokens.map((token) => {
		let color = COLORS[token.type];
		return color ? <span style={`color:${color};`}>{token.value}</span> : token.value;
	});
}
```

## Pattern: Theming The Stylesheet

Load the selector layer, then declare the properties for the roles you have an opinion about.
The rest keep the defaults:

```typescript
import "@sdxc/highlight/styles.css";
```

```css
:root {
	--highlight-comment: #8b949e;
	--highlight-keyword: #ff7b72;
	--highlight-string: #a5d6ff;
}
```

The stylesheet sets colour and nothing else. A block's padding, border and radius belong to
the page around it, as does any weight or face a theme spends on a role — a bold keyword, an
italic comment — which a consumer adds with its own rules on the same classes.

## Pattern: Writing A Grammar

A grammar is a record of modes, each a list of rules tried in order at the cursor:

```typescript
import type { Grammar } from "@sdxc/highlight";

export let ini: Grammar = {
	main: [
		{ type: "comment", match: /[#;][^\n]*/y },
		{ type: "tag", match: /\[[^\]\n]*\]/y },
		{ type: "property", match: /[A-Za-z_][\w.]*(?=\s*=)/y },
		{ type: "operator", match: /=/y },
		{ type: "string", match: /"(?:\\[\s\S]|[^"\\\n])*"?/y },
	],
};
```

Anything no rule claims accumulates into a `plain` run, so a grammar is complete from its
first rule and grows by claiming more. Rule order is priority: a comment rule goes above the
operator rule that would otherwise claim its opening `/`.

Nesting is a mode. A rule with `push` enters one and a rule with `pop` leaves it, which is how
a template literal's `${…}` returns to being a string, and how a `<script>` body highlights as
JavaScript and then stops at `</script>`. A construct that nests inside itself pushes its own
mode again, so the brace that closes it is the one that matched:

```typescript
let interpolation: Rule[] = [
	{ type: "punctuation", match: /\}/y, pop: true },
	{ type: "punctuation", match: /\{/y, push: "interpolation" },
	...expression,
];
```

Keep every pattern linear — no quantifier inside another quantifier over the same characters
— so that highlighting a block costs what the block is long. Reach for a mode before a
lookahead: a construct that spans a region is a mode, and lookarounds decide what a single
character means, like whether a `/` divides or opens a regular expression. And pick the
nearest existing token type; a grammar that wants a twenty-first one usually wants `builtin`,
`property` or `constant`.

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
