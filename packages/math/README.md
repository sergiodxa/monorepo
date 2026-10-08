# @sdxc/math

TeX math to MathML Core, with a markdown walk visitor and a component.

Browsers render [MathML Core](https://developer.mozilla.org/en-US/docs/Web/MathML) natively,
so a formula needs no stylesheet, no web font and no client JavaScript. This package reads a
practical subset of TeX into a JSON tree of MathML elements and writes it as markup or as
component elements.

## Installation

```sh
npm add @sdxc/math
```

The root entry depends only on [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result).
`@sdxc/math/markdown` walks documents from
[`@sdxc/markdown`](https://www.npmjs.com/package/@sdxc/markdown), and `@sdxc/math/ui` renders
with `remix/component`; both install alongside this package.

## Usage

### Convert TeX

```typescript
import { toMathML } from "@sdxc/math";
import { isFailure } from "@sdxc/result";

let result = toMathML("\\frac{a}{b}", { display: true });
if (isFailure(result)) throw result.error;

result.data;
// '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><semantics>
//   <mfrac><mi>a</mi><mi>b</mi></mfrac>
//   <annotation encoding="application/x-tex">\frac{a}{b}</annotation>
// </semantics></math>'
```

The formula travels with its TeX as an annotation, which screen readers and copy-paste can
read back.

### Render Math In Markdown

````typescript
import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";
import { math, renderMath } from "@sdxc/math/markdown";
import { isFailure } from "@sdxc/result";

let parsed = Markdown.parse("Euler: $`e^{i\\pi} + 1 = 0`$\n\n```math\n\\sum_{i=1}^n i\n```\n");
if (isFailure(parsed)) throw parsed.error;

let walked = Markdown.walk(parsed.data.document, math);
if (isFailure(walked)) throw walked.error;

let html = toHTML(walked.data, { tags: { math: renderMath } });
````

The visitor reads the two forms GitHub renders: a fenced block whose language is `math`, and
inline code wrapped in dollar signs, ``$`x^2`$``. Each becomes a `math` tag node carrying
`{ tex, display }`.

### Render With Remix

```tsx
import { toRemix } from "@sdxc/markdown/remix";
import { MathFormula, MathTag } from "@sdxc/math/ui";

<p>
	The area is <MathFormula tex="\pi r^2" />.
</p>;

<article>{toRemix(walked.data, { components: { math: MathTag } })}</article>;
```

## API

### `toMathML(tex: string, options?: MathOptions): Result<string, MathError>`

Converts TeX to a MathML string, every value escaped, ready for HTML or XHTML. Every element
has an explicit closing tag, so HTML and XML parsers read it the same way.

### `parseMath(tex: string, options?: MathOptions): Result<MathElement, MathError>`

Reads TeX into the tree `toMathML` serializes, rooted at the `math` element. The tree is plain
JSON, so it caches and travels in a payload.

```typescript
let tree = parseMath("x^2");
// { type: "element", name: "math", attributes: { xmlns: "…", display: "inline" }, children: [ … ] }
```

### `MathOptions`

- `display`: a block formula. Sets `display="block"` and moves the limits of `\sum`, `\prod`,
  `\lim` and similar operators under and over them. Defaults to `false`.

### `MathError`

The first construct the parser refused. `reason` says what went wrong; `index` (0-based),
`line` and `column` (1-based) locate it in the TeX, and the message ends with `line:column`.

```typescript
parseMath("a + \\foo"); // failure: "Unknown command \foo at 1:5"
```

### Types

#### `MathNode`, `MathElement`, `MathText`

A node is an element, `{ type: "element", name, attributes, children }` with string
attribute values, or text, `{ type: "text", value }` holding the unescaped characters.

### `@sdxc/math/markdown`

#### `math`

The `Markdown.walk` visitor. A formula that does not convert fails the walk, and the failure's
`cause` is the `MathError`, so a broken formula stops a build. Every handler is synchronous,
so the walk returns a `Result`, never a promise.

#### `createMathVisitor(options?: MathVisitorOptions)`

Builds the visitor with options. `invalid: "keep"` leaves a formula that does not convert as
the code block or inline code it was written as; `invalid: "fail"` is the default.

#### `renderMath`

A tag renderer for `toHTML`'s `tags` option. A tag whose TeX does not convert renders as the
escaped TeX inside `<code>`.

### `@sdxc/math/ui`

#### `MathFormula`

A `remix/component` component taking `tex` and `display`. It builds the MathML as elements and
renders the TeX in a `<code>` when it does not convert. Render it on the server: the browser's
HTML parser places the elements in the MathML namespace, which a client-side render does not.

#### `MathTag`

`MathFormula` shaped for `toRemix`'s `components` option, which hands every component its
children alongside the tag's attributes.

## Supported TeX

- Numbers, letters (each an identifier), operators `+ - = < > , ; : ! ? / * . '`, grouping `{}`
- Scripts `^` and `_`, alone or together, with TeX's one-token rule: `x^23` raises only the 2
- `\frac`, `\dfrac`, `\tfrac`, `\binom`, `\sqrt{x}`, `\sqrt[n]{x}`
- Greek letters `\alpha` … `\omega`, the `\var` forms, and uppercase `\Gamma` … `\Omega`
- Operators, relations and arrows such as `\cdot \times \pm \leq \neq \approx \in`,
  `\subseteq \cup \to \Rightarrow \iff \forall \exists \ldots \cdots`, and `\infty \partial \nabla`
- Big operators `\sum \prod \coprod \bigcup \bigcap` with limits in display mode, integrals
  `\int \iint \iiint \oint` with limits beside them, and `\limits` / `\nolimits`
- Functions `\sin \cos \tan \log \ln \exp \det \max \min \sup \inf \lim` and more, plus
  `\operatorname{…}`
- `\left … \right` with `( ) [ ] | / .` and
  `\{ \} \langle \rangle \lvert \rvert \| \lfloor \rfloor \lceil \rceil`
- `\text{…}`, `\mathrm`, `\mathbf`, `\mathit`, `\mathbb`
- Accents `\hat \bar \vec \tilde \dot \ddot`
- Spacing `\, \: \; \! \quad \qquad \enspace`, `~` and `\ `
- Environments `matrix`, `pmatrix`, `bmatrix`, `Bmatrix`, `vmatrix`, `Vmatrix` and `cases`,
  with `&` between cells and `\\` between rows; both are errors outside an environment

Any other command is a `MathError` naming it.

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
