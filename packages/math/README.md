# @sdxc/math

TeX math to MathML Core, with a markdown walk visitor and a component.

Browsers render [MathML Core](https://developer.mozilla.org/en-US/docs/Web/MathML) natively, so a
formula needs no stylesheet, web font or client JavaScript. This package reads a practical subset
of TeX into a JSON tree of MathML elements and writes it as markup or as component elements.

## Installation

```sh
npm add @sdxc/math
```

Conversions answer a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result).
`@sdxc/math/markdown` walks documents from
[`@sdxc/markdown`](https://www.npmjs.com/package/@sdxc/markdown), and `@sdxc/math/ui` renders with
`remix/component` from [`remix`](https://www.npmjs.com/package/remix).

## Usage

### Convert TeX

```typescript
import { toMathML } from "@sdxc/math";
import { isFailure } from "@sdxc/result";

let result = toMathML("\\frac{a}{b}", { display: true });
if (isFailure(result)) throw result.error;

result.data;
// <math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><semantics>
//   <mfrac><mi>a</mi><mi>b</mi></mfrac>
//   <annotation encoding="application/x-tex">\frac{a}{b}</annotation>
// </semantics></math>
```

Leave `display` off for a formula inside a sentence. The TeX travels with the formula as an
annotation, which screen readers and copy-paste read back.

### Read the tree

```typescript
import { parseMath } from "@sdxc/math";

let tree = parseMath("x^2");
// success: { type: "element", name: "math", attributes: { xmlns: "…", display: "inline" }, children: [ … ] }
```

The tree is plain JSON, so it caches and travels in a payload.

### Render math in markdown

```typescript
import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";
import { math, renderMath } from "@sdxc/math/markdown";
import { isFailure } from "@sdxc/result";

let fence = "`".repeat(3);
let source = `Euler: $\`e^{i\\pi} + 1 = 0\`$\n\n${fence}math\n\\sum_{i=1}^n i\n${fence}\n`;

let parsed = Markdown.parse(source);
if (isFailure(parsed)) throw parsed.error;

let walked = Markdown.walk(parsed.data.document, math);
if (isFailure(walked)) throw walked.error;

let html = toHTML(walked.data, { tags: { math: renderMath } });
```

The visitor reads the two forms GitHub renders: a fenced block whose language is `math` (display),
and inline code wrapped in dollar signs, ``$`x^2`$`` (inline). Each becomes a `math` tag node with
`{ tex, display }` attributes.

### Render with Remix

```tsx
import { MathFormula } from "@sdxc/math/ui";

<p>
	The area is <MathFormula tex="\pi r^2" />.
</p>;

<MathFormula tex="\int_0^1 x^2 \, dx = \frac{1}{3}" display />;
```

Render it on the server: the browser's HTML parser places the elements in the MathML namespace.

## API

### `toMathML(tex: string, options?: MathOptions): Result<string, MathError>`

Converts TeX to a MathML string with every value escaped and every element explicitly closed,
ready for HTML or XHTML.

### `parseMath(tex: string, options?: MathOptions): Result<MathElement, MathError>`

Reads TeX into the tree `toMathML` serializes: a `math` element holding a `semantics` element with
the formula and its TeX annotation.

### `MathError`

The first construct the parser refused. `reason` says what went wrong; `index` (0-based), `line`
and `column` (1-based) locate it in the TeX, and `message` ends with `line:column`.

```typescript
parseMath("a + \\foo"); // failure: "Unknown command \foo at 1:5"
```

### `@sdxc/math/markdown`

#### `math`

The `Markdown.walk` visitor with default options. A formula that does not convert fails the walk,
with the `MathError` as the failure's `cause`. The walk stays synchronous and returns a `Result`.

#### `createMathVisitor(options?: MathVisitorOptions)`

Builds the visitor. `invalid: "fail"` (the default) fails the walk on a formula that does not
convert; `invalid: "keep"` leaves it as the code block or inline code the author wrote.

#### `renderMath`

A tag renderer for `toHTML`'s `tags` option. A tag whose TeX does not convert renders as the
escaped TeX inside `<code>`.

### `@sdxc/math/ui`

#### `MathFormula`

A `remix/component` component taking `tex` and `display`. It builds the MathML as elements, and
renders the TeX in a `<code>` when it does not convert.

#### `MathTag`

`MathFormula` shaped for `toRemix`'s `components` option, which passes a walked `math` tag's
attributes plus `children`.

Register `MathTag` there, since `MathFormula` takes no `children` and fails to type-check in
that map.

### Types

#### `MathOptions`

- `display`: a block formula. Sets `display="block"` and places the limits of `\sum`, `\prod`,
  `\lim` and similar operators under and over them. Defaults to `false`.

#### `MathVisitorOptions`

- `invalid`: `"fail"` or `"keep"`, as described under `createMathVisitor`.

#### `MathNode`, `MathElement`, `MathText`

A node is an element, `{ type: "element", name, attributes, children }` with string attribute
values, or text, `{ type: "text", value }` holding the unescaped characters.

#### `MathFormula.Props`

`{ tex: string; display?: boolean }`, the props `MathFormula` accepts.

## Supported TeX

- Numbers, letters (each an identifier), operators `+ - = < > , ; : ! ? / * . '`, grouping `{}`
- Scripts `^` and `_`, alone or together, with TeX's one-token rule: `x^23` raises only the 2
- `\frac`, `\dfrac`, `\tfrac`, `\binom`, `\sqrt{x}`, `\sqrt[n]{x}`
- Greek letters `\alpha` … `\omega`, the `\var` forms, and uppercase `\Gamma` … `\Omega`
- Operators, relations and arrows such as `\cdot \times \pm \leq \neq \approx \in`,
  `\subseteq \cup \to \Rightarrow \iff \forall \exists \ldots \cdots`, and `\infty \partial \nabla`
- Big operators `\sum \prod \coprod \bigcup \bigcap \bigoplus \bigotimes \bigvee \bigwedge` with
  limits in display mode, integrals `\int \iint \iiint \oint` with limits beside them, and
  `\limits` / `\nolimits`
- Functions `\sin \cos \tan \log \ln \exp \det \gcd \max \min \sup \inf \lim` and more, plus
  `\operatorname{…}`
- `\left … \right` with `( ) [ ] | / .` and
  `\{ \} \langle \rangle \lvert \rvert \| \lfloor \rfloor \lceil \rceil`
- `\text{…}`, `\textrm{…}`, `\mbox{…}`, `\mathrm`, `\mathbf`, `\mathit`, `\mathbb`
- Accents `\hat \bar \vec \tilde \dot \ddot`
- Spacing `\, \: \> \; \! \quad \qquad \enspace`, `~` and `\ `
- Environments `matrix`, `pmatrix`, `bmatrix`, `Bmatrix`, `vmatrix`, `Vmatrix` and `cases`, with
  `&` between cells and `\\` between rows

Any other command is a `MathError` naming it.

## Pattern: Validate TeX From A Form

Check a formula before saving it, and point the author at the character that broke it.

```typescript
import { toMathML } from "@sdxc/math";
import { isFailure } from "@sdxc/result";

function validateFormula(tex: string) {
	let result = toMathML(tex, { display: true });
	if (isFailure(result)) {
		let { reason, line, column } = result.error;
		return { ok: false as const, message: `${reason} (line ${line}, column ${column})` };
	}
	return { ok: true as const, tex, preview: result.data };
}

validateFormula("\\frac{1}{\\foo}");
// { ok: false, message: "Unknown command \foo (line 1, column 10)" }
```

## Pattern: Fail A Build On A Broken Formula

Walk with `math` so a formula that does not convert stops the build, and report both where it sits
in the document and where the TeX broke.

```typescript
import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";
import { MathError } from "@sdxc/math";
import { math, renderMath } from "@sdxc/math/markdown";
import { isFailure } from "@sdxc/result";

function build(file: string, source: string): string {
	let parsed = Markdown.parse(source);
	if (isFailure(parsed)) throw parsed.error;

	let walked = Markdown.walk(parsed.data.document, math);
	if (isFailure(walked)) {
		let { cause, position } = walked.error;
		if (cause instanceof MathError) {
			throw new Error(`${file}:${position?.start.line}: ${cause.message}`, { cause });
		}
		throw walked.error;
	}

	return toHTML(walked.data, { tags: { math: renderMath } });
}
```

## Pattern: Keep Building When A Formula Breaks

A preview pane renders what it can while an author types. Walk with `invalid: "keep"` so a
half-written formula stays code instead of failing the page.

```typescript
import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";
import { createMathVisitor, renderMath } from "@sdxc/math/markdown";
import { isFailure } from "@sdxc/result";

let preview = createMathVisitor({ invalid: "keep" });

function render(source: string): string {
	let parsed = Markdown.parse(source);
	if (isFailure(parsed)) return "";
	let walked = Markdown.walk(parsed.data.document, preview);
	if (isFailure(walked)) return "";
	return toHTML(walked.data, { tags: { math: renderMath } });
}
```

## Pattern: Render A Markdown Article With Remix

Draw walked `math` tags with `MathTag` when the page renders markdown through `toRemix`.

```tsx
import type { Handle } from "remix/component";

import { Markdown } from "@sdxc/markdown";
import { toRemix } from "@sdxc/markdown/remix";
import { math } from "@sdxc/math/markdown";
import { MathTag } from "@sdxc/math/ui";
import { isFailure } from "@sdxc/result";

function Article(handle: Handle<{ source: string }>) {
	return () => {
		let parsed = Markdown.parse(handle.props.source);
		if (isFailure(parsed)) return <p>Could not read this article.</p>;
		let walked = Markdown.walk(parsed.data.document, math);
		if (isFailure(walked)) return <p>{walked.error.message}</p>;
		return <article>{toRemix(walked.data, { components: { math: MathTag } })}</article>;
	};
}
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/math": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
