# @sdxc/diagram

Mermaid sequence, class, state and flowchart diagrams to SVG, with a markdown walk visitor and
a component.

Diagrams are written in [Mermaid](https://mermaid.js.org)'s text syntax, the one GitHub renders
in a fenced block marked `mermaid`, and drawn as SVG on the server: no client script, no
stylesheet and no web font. The SVG strokes and fills with `currentColor` and the `Canvas`
system color, so a diagram takes the color of the text around it and follows the page into
dark mode.

## Installation

```sh
npm add @sdxc/diagram
```

The root entry depends only on [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result).
`@sdxc/diagram/markdown` walks documents from
[`@sdxc/markdown`](https://www.npmjs.com/package/@sdxc/markdown), and `@sdxc/diagram/ui`
renders with `remix/component`; both install alongside this package.

## Usage

### Draw A Diagram

```typescript
import { toSVG } from "@sdxc/diagram";
import { isFailure } from "@sdxc/result";

let result = toSVG(`sequenceDiagram
    Browser->>+API: POST /posts
    API-->>-Browser: 201 Created`);
if (isFailure(result)) throw result.error;

result.data; // '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 …" role="img"><title>Sequence diagram</title>…'
```

The string is safe to place in HTML or XHTML, or to save as an `.svg` file, as it is.

### Render Diagrams In Markdown

````typescript
import { diagram, renderDiagram } from "@sdxc/diagram/markdown";
import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";
import { isFailure } from "@sdxc/result";

let parsed = Markdown.parse("```mermaid\nflowchart LR\n  Parse --> Walk --> Render\n```\n");
if (isFailure(parsed)) throw parsed.error;

let walked = Markdown.walk(parsed.data.document, diagram);
if (isFailure(walked)) throw walked.error;

let html = toHTML(walked.data, { tags: { diagram: renderDiagram } });
````

The visitor turns every fenced block whose language is `mermaid` into a `diagram` tag node
carrying `{ source }`, and leaves every other code block alone, so it composes with a
highlighter through `Markdown.compose`.

An `alt` annotation on the fence names the drawing for screen readers, in place of the name its
source gives it, and the tag carries it as `{ source, alt }`:

````markdown
```mermaid {% alt="The checkout flow: cart, then payment, then confirmation" %}
flowchart LR
  Cart --> Payment --> Confirmation
```
````

### Render With Remix

```tsx
import { Diagram, DiagramTag } from "@sdxc/diagram/ui";
import { toRemix } from "@sdxc/markdown/remix";

<Diagram source={"stateDiagram-v2\n  [*] --> Draft\n  Draft --> Published"} />;

<article>{toRemix(walked.data, { components: { diagram: DiagramTag } })}</article>;
```

## API

### `toSVG(source: string, options?: DiagramOptions): Result<string, DiagramError>`

Draws the diagram as an SVG string, every value escaped. Every element has an explicit closing
tag, so HTML and XML parsers read it the same way.

### `parseDiagram(source: string, options?: DiagramOptions): Result<SvgElement, DiagramError>`

Reads the diagram into the tree `toSVG` serializes, rooted at the `svg` element. The tree is
plain JSON, so it caches and travels in a payload.

```typescript
let tree = parseDiagram("flowchart LR\nA --> B");
// { type: "element", name: "svg", attributes: { xmlns: "…", viewBox: "0 0 … …", … }, children: [ … ] }
```

The root carries `width`, `height` and a matching `viewBox`, with `max-width: 100%` so it
shrinks to a narrow column. Its first child is a `title` naming the diagram, read out as its
accessible name, followed by a `desc` when the source has an `accDescr`. The `title` is
`options.alt` when given, then the source's `title` or `accTitle`, then the diagram's kind.

### `DiagramError`

The first statement the parser refused. `reason` says what went wrong; `index` (0-based),
`line` and `column` (1-based) locate it in the source, and the message ends with `line:column`.

```typescript
parseDiagram("sequenceDiagram\n  A->>B: hi\n  end"); // failure: '"end" without a block to close at 3:3'
```

### Types

#### `DiagramOptions`

`{ alt?: string }`: the drawing's accessible name, written as its `title` over the one the
source gives it. An empty `alt` keeps the source's name.

#### `SvgNode`, `SvgElement`, `SvgText`

A node is an element, `{ type: "element", name, attributes, children }` with string attribute
values, or text, `{ type: "text", value }` holding the unescaped characters.

### `@sdxc/diagram/markdown`

#### `diagram`

The `Markdown.walk` visitor. A diagram that does not parse fails the walk: the failure's
`position` is the fence, and its `cause` is the `DiagramError` locating the statement inside
the diagram. Its handler is synchronous, so the walk returns a `Result`, never a promise.

#### `createDiagramVisitor(options?: DiagramVisitorOptions)`

Builds the visitor with options. `invalid: "keep"` leaves a diagram that does not parse as the
code block it was written as; `invalid: "fail"` is the default.

#### `renderDiagram`

A tag renderer for `toHTML`'s `tags` option, naming the drawing by the tag's `alt` when it has
one. A tag whose source does not parse renders as the
escaped source in `<pre><code class="language-mermaid">`.

### `@sdxc/diagram/ui`

#### `Diagram`

A `remix/component` component taking `source` and an optional `alt`. It builds the SVG as elements, and renders the
source in a code block when it does not parse.

#### `DiagramTag`

`Diagram` shaped for `toRemix`'s `components` option, which hands every component its children
alongside the tag's attributes.

## Theming

Lines and text draw in `currentColor`. Two custom properties set the fills, and each falls
back to the page's background:

- `--diagram-fill`: node bodies, and the boxes behind line labels. Defaults to `Canvas`.
- `--diagram-tint`: notes, groups and block tabs. Defaults to `currentColor` mixed 8% into
  `Canvas`.

```css
.prose svg {
	color: var(--text-muted);
	--diagram-fill: var(--surface);
}
```

Labels are measured from a typical sans-serif face and set in `ui-sans-serif, system-ui`, with
a little room to spare, so every box holds its text whichever system font the reader has.

## Supported Syntax

Every kind accepts `%%` comment lines, a `title` statement, `accTitle:` and `accDescr:`, and a
frontmatter block with a `title`. Labels break onto a new line at `<br>`.

### `sequenceDiagram`

- `participant A`, `actor A`, and either `as` a display name
- Messages `->>` `-->>` `->` `-->` `-x` `--x` `-)` `--)` `<<->>` `<<-->>`, with or without
  `: text`, to another participant or to the sender itself
- Activations: `activate A` / `deactivate A`, or `+` and `-` before the receiver
- `Note left of A`, `Note right of A`, `Note over A` and `Note over A,B`
- `loop`, `alt` / `else`, `opt`, `par` / `and`, `critical` / `option`, `break` and `rect`, each
  closed with `end`
- `autonumber`

### `flowchart` and `graph`

- Directions `TB`, `TD`, `BT`, `LR` and `RL`, in the header or as `direction`
- Shapes `A[ ]`, `A( )`, `A([ ])`, `A[[ ]]`, `A[( )]`, `A(( ))`, `A((( )))`, `A{ }`,
  `A{{ }}`, `A[/ /]`, `A[\ \]`, `A[/ \]`, `A[\ /]` and `A> ]`, with quoted text for labels that
  hold brackets
- Links `-->` `---` `-.->` `-.-` `==>` `===` `~~~`, heads `>` `o` `x` at either end, extra
  dashes for a longer link, and text as `-->|text|` or `-- text -->`
- Chains `A --> B --> C` and groups `A & B --> C`, and `;` between statements
- `subgraph id [Title]` … `end`, nested, with a `direction` of its own; a node named inside a
  subgraph belongs to it, and a link may name the subgraph as an end
- `classDef`, `class`, `style`, `linkStyle`, `click` and `:::class` are read and the diagram
  draws in the page's colors

### `classDiagram`

- `class A`, `class A~T~`, `class A["Label"]` and bodies in `{ }`
- Members as `A : +member` or in the body; parentheses make a method, a trailing `$` static
  (underlined) and `*` abstract (italic), and `~T~` writes as `<T>`
- Annotations `<<interface>> A` or inside the body
- Relations `<|--` `*--` `o--` `-->` `--` `..>` `..|>` `..`, in either direction and with both
  ends, `"1"` cardinalities at either end and `: label`; a parent or whole sits above the
  class pointing at it
- `note for A "text"`, `note "text"`, `namespace N { }` and `direction`

### `stateDiagram` and `stateDiagram-v2`

- `A --> B : label`, with `[*]` as each scope's start or end
- `state "Name" as A`, `A : description`, and `state A <<choice>>`, `<<fork>>`, `<<join>>`
- Composite states `state A { … }`, nested, with a `direction` of their own
- `note left of A : text` and multi-line notes closed with `end note`

Anything else is a `DiagramError` naming the statement.

## Pattern: Keep Building When A Diagram Breaks

A preview pane renders what it can while an author types. Walk with `invalid: "keep"` so a
half-written diagram stays code instead of failing the page.

```typescript
import { createDiagramVisitor, renderDiagram } from "@sdxc/diagram/markdown";
import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";
import { isFailure } from "@sdxc/result";

let preview = createDiagramVisitor({ invalid: "keep" });

function render(source: string): string {
	let parsed = Markdown.parse(source);
	if (isFailure(parsed)) return "";
	let walked = Markdown.walk(parsed.data.document, preview);
	if (isFailure(walked)) return "";
	return toHTML(walked.data, { tags: { diagram: renderDiagram } });
}
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/diagram": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
