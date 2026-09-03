# @sdxc/highlight

Syntax highlighting as tokens, with a Markdoc node for fenced code and a stylesheet keyed to the tokens it produces.

## Overview

A highlighter's real output is not markup — it is a sequence of runs, each labelled with what it is. Markup is one way to render that, and it is the wrong way when the renderer builds a component tree: a string of `<span>`s handed to a JSX runtime arrives escaped, as its own source, and a string handed to `innerHTML` moves the escaping obligation onto whoever assembled it. So this package returns tokens, and a caller renders them however it renders anything else.

There is no global registry and no import order to get right. A grammar is a value that a module exports, and a grammar built on another imports it and merges with [`compose`](#composeparts-arrayrecordstring-rule-grammar). `Token.Type` is a closed union of twenty members, small enough that one stylesheet paints all of it and a palette can map over it exhaustively; a grammar picks the nearest member rather than introducing its own. A language with no grammar is not a failure — it comes back as a single `plain` token holding the whole input, the same shape every other language produces.

The package splits by dependency. The root entry has none: it is the scanner, the grammars, and the token model. `@sdxc/highlight/markdoc` adds the fence node and depends on [Markdoc](https://markdoc.dev), so a caller that only tokenizes never resolves it. `@sdxc/highlight/styles.css` is the selector layer, one rule per token type, each reading a custom property so a consumer restyles by declaring properties rather than by restating selectors.

## Usage

### Basic Example

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

The language arrives as an author wrote it on a fence, so `tokenize` resolves aliases itself — `ts`, `js`, `sh`, `yml`, `jsonc`, `gql` land on the grammar that serves them, and `text`, `txt` and `dotenv` land on `plain`.

### Rendering Tokens

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

### Rendering Markup

When a caller needs a string rather than elements:

```typescript
import { highlight } from "@sdxc/highlight";

let markup = highlight('let name = "x";', "ts");
// '<span class="token keyword">let</span> name <span class="token operator">=</span> …'
```

### Highlighting Markdown Fences

```typescript
import { fence } from "@sdxc/highlight/markdoc";
import Markdoc from "@markdoc/markdoc";

let tree = Markdoc.transform(Markdoc.parse(source), { nodes: { fence } });
```

## API

### `tokenize(code: string, language: string): Token[]`

Tokenizes source as a language.

**Parameters:**

- `code`: Source to highlight
- `language`: Language name or alias, as written on a fence

**Returns:**

- The tokens, in source order, covering the input exactly once. A language with no grammar yields one `plain` token holding the whole input, and empty source yields an empty list.

**Example:**

```typescript
let tokens = tokenize("SELECT 1", "sql");
let covered = tokens.map((token) => token.value).join("") === "SELECT 1"; // always true
```

### `highlight(code: string, language: string): string`

Highlights source into `<span class="token …">` markup, escaping every value it writes, `plain` included.

**Parameters:**

- `code`: Source to highlight
- `language`: Language name or alias, as written on a fence

**Returns:**

- Markup safe to place inside a `<pre><code>`

**Example:**

```typescript
let markup = highlight("<b>&</b>", "hcl"); // "&lt;b&gt;&amp;&lt;/b&gt;"
```

### `normalizeLanguage(language: string): string`

Resolves what a fence wrote to the name a grammar answers to, lowercasing it and following an alias when one applies. The result is a name to display and to look up, not a promise that a grammar exists.

**Parameters:**

- `language`: Language as written on the fence

**Returns:**

- The resolved language name, or the lowercased input when no alias applies

**Example:**

```typescript
normalizeLanguage("SH"); // "bash"
normalizeLanguage("txt"); // "plain"
normalizeLanguage("hcl"); // "hcl" — no grammar, and still a usable class name
```

### `languages`

Every grammar, by the name it registers under: `bash`, `css`, `diff`, `graphql`, `html`, `http`, `javascript`, `json`, `jsx`, `markdown`, `plain`, `python`, `ruby`, `sql`, `tsx`, `typescript`, `yaml`.

`html` also serves the `xml`, `svg`, `rss`, `atom`, `mathml` and `erb` aliases, since it is general markup rather than a list of known element names.

**Example:**

```typescript
let painted = Object.hasOwn(languages, normalizeLanguage("toml")); // false
```

### `scan(code: string, grammar: Grammar): Token[]`

Scans source with a grammar directly, skipping the registry and the alias table. Adjacent runs of the same type arrive merged, so the output is the same whether a grammar spells a construct as one rule or several.

**Parameters:**

- `code`: Source to scan
- `grammar`: The language to scan it as

**Returns:**

- The tokens, in source order, covering the input exactly once

**Example:**

```typescript
import { scan } from "@sdxc/highlight";
import { ini } from "./ini";

let tokens = scan("[server]\nport = 8080\n", ini);
```

### `compose(...parts: Array<Record<string, Rule[]>>): Grammar`

Merges grammars into one, mode by mode, so a language built on another states that as an import. The earlier part's rules are tried first, which is how a JSX tag wins over a TypeScript comparison on the same `<`. A part with no `main` of its own merges the same way, which is how a set of modes lifted off another grammar joins one.

**Parameters:**

- `parts`: The grammars and mode sets to merge, in priority order

**Returns:**

- A grammar holding every mode any part defines

**Example:**

```typescript
import { compose } from "@sdxc/highlight";

export const tsx: Grammar = compose(elements, typescript);
```

### `fence`

Markdoc node definition for fenced code blocks, exported from `@sdxc/highlight/markdoc`. Register it as `nodes.fence` and fences highlight during `Markdoc.transform`: it reads the fence's `language`, `path` and `title`, resolves the language, tokenizes the body, and emits a `Fence` tag for a renderer to draw. This package draws nothing — the renderer decides whether a path gets a header, a block gets a copy button, or lines get numbers.

**Example:**

````markdown
```ts {% path="app/routes.ts" title="Route table" %}
export default [];
```
````

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

`attr-name`, `attr-value`, `boolean`, `builtin`, `class-name`, `comment`, `constant`, `deleted`, `function`, `inserted`, `keyword`, `number`, `operator`, `plain`, `property`, `punctuation`, `regex`, `string`, `tag`, `variable`.

`builtin` is for names the language itself provides, `class-name` for types and classes, `property` for a key of any kind, `tag` for a markup tag name and a CSS selector, `variable` for a sigil-marked name, `inserted` and `deleted` for the two sides of a diff, and `plain` for everything no rule claimed.

#### `Rule`

```typescript
interface Rule {
	type: Token.Type;
	match: RegExp;
	push?: string;
	pop?: true;
}
```

`match` carries the sticky flag, so it matches where the scanner is rather than searching ahead. `push` and `pop` move the mode stack, and a rule uses one or the other.

#### `Grammar`

```typescript
interface Grammar {
	main: Rule[];
	[mode: string]: Rule[];
}
```

`main` is where scanning starts. Every other entry is a context a rule pushes onto the stack — a template literal's interpolation, a markup tag's attributes, the body of an embedded language.

#### `fence.Attributes`

```typescript
interface Attributes {
	tokens: Token[];
	language: string;
	path?: string;
	title?: string;
}
```

What a `Fence` tag carries. Tokens rather than markup, so a renderer emits its own elements.

## Pattern: Painting Tokens Without A Stylesheet

An email has no stylesheet to load, so the colour has to be inline. Key the palette by the type union and the compiler checks it covers every member, which is what keeps a type added upstream from silently rendering unpainted:

```typescript
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

Load the selector layer, then declare the properties for the roles you have an opinion about. The rest keep the defaults:

```tsx
import highlightStyles from "@sdxc/highlight/styles.css?url";

export let links = () => [{ rel: "stylesheet", href: highlightStyles }];
```

```css
:root {
	--highlight-comment: var(--ui-neutral-fg);
	--highlight-keyword: var(--ui-color-brand-800);
	--highlight-string: var(--ui-brand-fg);
}
```

The stylesheet sets colour and nothing else. A block's padding, border and radius belong to the page around it, as does any weight or face a theme spends on a role — a bold keyword, an italic comment — which a consumer adds with its own rules on the same classes.

## Pattern: Writing A Grammar

A grammar is a record of modes, each a list of rules tried in order at the cursor:

```typescript
import type { Grammar } from "@sdxc/highlight";

export const ini: Grammar = {
	main: [
		{ type: "comment", match: /[#;][^\n]*/y },
		{ type: "tag", match: /\[[^\]\n]*\]/y },
		{ type: "property", match: /[A-Za-z_][\w.]*(?=\s*=)/y },
		{ type: "operator", match: /=/y },
		{ type: "string", match: /"(?:\\[\s\S]|[^"\\\n])*"?/y },
	],
};
```

Anything no rule claims accumulates into a `plain` run, so a grammar is complete from its first rule and grows by claiming more. Rule order is priority: a comment rule goes above the operator rule that would otherwise claim its opening `/`.

Nesting is a mode. A rule with `push` enters one and a rule with `pop` leaves it, which is how a template literal's `${…}` returns to being a string, and how a `<script>` body highlights as JavaScript and then stops at `</script>`. A construct that nests inside itself pushes its own mode again, so the brace that closes it is the one that matched:

```typescript
interpolation: [
	{ type: "punctuation", match: /\}/y, pop: true },
	{ type: "punctuation", match: /\{/y, push: "interpolation" },
	...expression,
];
```

Four properties are checked for every rule of every registered grammar by `src/lexer.test.ts`, so a new grammar inherits the tests: the pattern is sticky and not global, it matches at least one character, any mode it pushes exists, and its type is one of the twenty.

## Related Packages

- [`@sdxc/markdown`](/packages/markdown) - Registers the fence node, and renders its `Fence` tag into Remix UI nodes
- [`@sdxc/mail`](/packages/mail) - Registers the same node, and paints its tokens inline for an inbox

## Tips

1. **Prefer tokens to markup** - `highlight()` exists for callers that need a string; a caller rendering components maps `tokenize()` and emits elements, which keeps escaping out of the contract entirely.
2. **Check the language, do not guard it** - Every language tokenizes, so there is no unknown-language branch to write. Use `languages` and `normalizeLanguage` when the question is whether a fence will be painted, not whether it will render.
3. **Keep every pattern linear** - No quantifier inside another quantifier over the same characters. The point of scanning at a fixed position is that highlighting a fence cannot cost more than the fence is long.
4. **Order rules by specificity** - The first rule that matches at the cursor wins, so a keyword rule belongs above the identifier rule that would claim the same word.
5. **Reach for a mode before a lookahead** - A construct that spans a region — a string body, a tag's attributes, an embedded language — is a mode. Lookarounds are for deciding what a single character means, like whether a `/` divides or opens a regular expression.
6. **Pick the nearest existing type** - The union is closed so that one stylesheet can paint every language. A grammar that wants a twenty-first type usually wants `builtin`, `property` or `constant`.
