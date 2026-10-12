# @sdxc/diagram

Mermaid sequence, class, state and flowchart diagrams to SVG, with a markdown walk visitor and
a component.

Diagrams are written in [Mermaid](https://mermaid.js.org)'s text syntax and drawn as SVG on the
server: no client script, no stylesheet and no web font. Lines and text draw in `currentColor`
and fills fall back to the `Canvas` system color, so a diagram takes the color of the text
around it and follows the page into dark mode.

## Installation

```sh
npm add @sdxc/diagram
```

The root entry uses [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result).
`@sdxc/diagram/markdown` walks documents from
[`@sdxc/markdown`](https://www.npmjs.com/package/@sdxc/markdown), and `@sdxc/diagram/ui`
renders with `remix/component` from [`remix`](https://www.npmjs.com/package/remix).

## Usage

### Draw a diagram

```typescript
import { toSVG } from "@sdxc/diagram";
import { isFailure } from "@sdxc/result";

let result = toSVG(`sequenceDiagram
    Browser->>+API: POST /posts
    API-->>-Browser: 201 Created`);
if (isFailure(result)) throw result.error;

result.data; // '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 …" role="img"><title>Sequence diagram</title>…'
```

The string goes into HTML or XHTML, or into an `.svg` file, as it is.

### Render diagrams in markdown

```typescript
import { diagram, renderDiagram } from "@sdxc/diagram/markdown";
import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";
import { isFailure } from "@sdxc/result";

let fence = "`".repeat(3);
let parsed = Markdown.parse(`${fence}mermaid
flowchart LR
  Parse --> Walk --> Render
${fence}
`);
if (isFailure(parsed)) throw parsed.error;

let walked = Markdown.walk(parsed.data.document, diagram);
if (isFailure(walked)) throw walked.error;

let html = toHTML(walked.data, { tags: { diagram: renderDiagram } });
```

The visitor turns every fence marked `mermaid` into a `diagram` tag carrying `{ source }` and
leaves every other code block to the next visitor, so it composes with a highlighter through
`Markdown.compose`.

### Render with Remix

```tsx
import { Diagram, DiagramTag } from "@sdxc/diagram/ui";
import { toRemix } from "@sdxc/markdown/remix";

<Diagram source={"stateDiagram-v2\n  [*] --> Draft\n  Draft --> Published"} />;

<article>{toRemix(walked.data, { components: { diagram: DiagramTag } })}</article>;
```

## API

### `toSVG(source: string, options?: DiagramOptions): Result<string, DiagramError>`

Draws the diagram as an SVG string with every value escaped and every element explicitly
closed, so HTML and XML parsers read it the same way.

### `parseDiagram(source: string, options?: DiagramOptions): Result<SvgElement, DiagramError>`

Reads the diagram into the tree `toSVG` serializes, rooted at an `svg` element with `width`,
`height`, a matching `viewBox` and `max-width: 100%`. The tree is plain JSON, so it caches and
travels in a payload.

```typescript
let tree = parseDiagram("flowchart LR\nA --> B");
// { type: "element", name: "svg", attributes: { xmlns: "…", viewBox: "0 0 … …", … }, children: [ … ] }
```

The first child is a `title`, the drawing's accessible name: `options.alt`, else the source's
`title` or `accTitle`, else the diagram's kind. A `desc` follows when the source has an
`accDescr`.

### `DiagramError`

The first statement the parser refused: `reason` says what went wrong, `index` (0-based),
`line` and `column` (1-based) locate it, and the message ends with `line:column`.

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

The `Markdown.walk` visitor. It also copies a fence's `{% alt="…" %}` annotation onto the tag
as `alt`. A diagram that does not parse fails the walk with a `MarkdownWalkError` whose
`position` is the fence and whose `cause` is the `DiagramError`. Its handler is synchronous,
so the walk returns a `Result`.

#### `createDiagramVisitor(options?: { invalid?: "fail" | "keep" }): Markdown.Visitor`

Builds the visitor. `invalid: "keep"` leaves a diagram that does not parse as the code block it
was written as; `"fail"` is the default, the behavior of `diagram`.

#### `renderDiagram`

A tag renderer for `toHTML`'s `tags` option, naming the drawing by the tag's `alt`. A tag whose
source does not parse renders as the escaped source in `<pre><code class="language-mermaid">`.

### `@sdxc/diagram/ui`

#### `Diagram`

A `remix/component` component taking `source` and an optional `alt`. It builds the SVG as
elements, and renders the source in a `<pre><code>` block when it does not parse.

#### `DiagramTag`

`Diagram` shaped for `toRemix`'s `components` option, taking the tag's `source` and `alt` as
props.

### Theming

Lines and text draw in `currentColor`. Two custom properties set the fills:

- `--diagram-fill`: node bodies, and the boxes behind line labels. Defaults to `Canvas`.
- `--diagram-tint`: notes, groups and block labels. Defaults to `currentColor` mixed 8% into
  `Canvas`.

Labels are set in `ui-sans-serif, system-ui` and measured with room to spare, so every box
holds its text in whichever system font the reader has.

### Supported syntax

Every kind accepts `%%` comment lines, a `title` statement, `accTitle:` and `accDescr:`, and a
frontmatter block with a `title`. Labels break onto a new line at `<br>`. Anything else is a
`DiagramError` naming the statement.

#### `sequenceDiagram`

- `participant A`, `actor A`, and either `as` a display name
- Messages `->>` `-->>` `->` `-->` `-x` `--x` `-)` `--)` `<<->>` `<<-->>`, with or without
  `: text`, to another participant or to the sender itself
- Activations: `activate A` / `deactivate A`, or `+` and `-` before the receiver
- `Note left of A`, `Note right of A`, `Note over A` and `Note over A,B`
- `loop`, `alt` / `else`, `opt`, `par` / `and`, `critical` / `option`, `break` and `rect`, each
  closed with `end`
- `autonumber`

#### `flowchart` and `graph`

- Directions `TB`, `TD`, `BT`, `LR` and `RL`, in the header or as `direction`
- Shapes `A[ ]`, `A( )`, `A([ ])`, `A[[ ]]`, `A[( )]`, `A(( ))`, `A((( )))`, `A{ }`,
  `A{{ }}`, `A[/ /]`, `A[\ \]`, `A[/ \]`, `A[\ /]` and `A> ]`, with quoted text for labels that
  hold brackets
- Links `-->` `---` `-.->` `-.-` `==>` `===` `~~~`, heads `>` `o` `x` at either end, extra
  dashes for a longer link, and text as `-->|text|` or `-- text -->`
- Chains `A --> B --> C`, groups `A & B --> C`, and `;` between statements
- `subgraph id [Title]` … `end`, nested, with its own `direction`; a node named inside a
  subgraph belongs to it, and a link may name the subgraph as an end
- `classDef`, `class`, `style`, `linkStyle`, `click` and `:::class` are accepted, and the
  diagram draws in the page's colors

#### `classDiagram` and `classDiagram-v2`

- `class A`, `class A~T~`, `class A["Label"]` and bodies in `{ }`
- Members as `A : +member` or in the body; parentheses make a method, a trailing `$` static
  (underlined) and `*` abstract (italic), and `~T~` writes as `<T>`
- Annotations `<<interface>> A` or inside the body
- Relations `<|--` `*--` `o--` `-->` `--` `..>` `..|>` `..`, in either direction and with both
  ends, `"1"` cardinalities at either end and `: label`; a parent or whole sits above the
  class pointing at it
- `note for A "text"`, `note "text"`, `namespace N { }` and `direction`
- `style`, `cssClass`, `click`, `link` and `callback` are accepted, and the diagram draws in the
  page's colors

#### `stateDiagram` and `stateDiagram-v2`

- `A --> B : label`, with `[*]` as each scope's start or end
- `state "Name" as A`, `A : description`, and `state A <<choice>>`, `<<fork>>`, `<<join>>`
- Composite states `state A { … }`, nested, with their own `direction`
- `note left of A : text` and multi-line notes closed with `end note`
- `classDef`, `class` and `style` are accepted, and the diagram draws in the page's colors

## Pattern: Keep A Live Preview Rendering While A Diagram Is Half-Written

A preview pane renders what it can while an author types. Walk with `invalid: "keep"` so a
half-written diagram shows as code and the rest of the page still renders.

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

## Pattern: Fail A Build At The Broken Line

A publish step walks with the default `diagram` visitor so a broken diagram stops the build.
The walk failure locates the fence and its `cause` locates the statement inside it; together
they give the line to open in the document.

```typescript
import { DiagramError } from "@sdxc/diagram";
import { diagram } from "@sdxc/diagram/markdown";
import { Markdown } from "@sdxc/markdown";
import { isFailure } from "@sdxc/result";

function check(file: string, source: string): string | null {
	let parsed = Markdown.parse(source);
	if (isFailure(parsed)) return `${file}: ${parsed.error.message}`;

	let walked = Markdown.walk(parsed.data.document, diagram);
	if (!isFailure(walked)) return null;

	let fence = walked.error.position?.start.line ?? 0;
	let cause = walked.error.cause;
	if (cause instanceof DiagramError) {
		return `${file}:${fence + cause.line}:${cause.column} ${cause.reason}`;
	}
	return `${file}:${fence} ${walked.error.message}`;
}
```

## Pattern: Name A Diagram For Screen Readers

The `title` a screen reader announces comes from the source's `title` or `accTitle` unless the
caller supplies an `alt`, and `accDescr` adds a longer description. Each entry point takes the
`alt` in its own place.

```tsx
import { toSVG } from "@sdxc/diagram";
import { Diagram } from "@sdxc/diagram/ui";

let svg = toSVG(
	`flowchart LR
  accDescr: An order moves from the cart to payment, then to confirmation
  Cart --> Payment --> Confirmation`,
	{ alt: "The checkout flow" },
);

<Diagram source={"flowchart LR\n  Cart --> Payment"} alt="The checkout flow" />;

let fence = "`".repeat(3);
let markdown = `${fence}mermaid {% alt="The checkout flow" %}
flowchart LR
  Cart --> Payment
${fence}
`;
```

The `diagram` visitor carries the fence's `alt` onto the tag, and both `renderDiagram` and
`DiagramTag` pass it on.

## Pattern: Match The Page's Colors

A diagram inherits `color` from its container, so styling the container themes the drawing,
in light and dark mode alike.

```css
.prose svg {
	color: var(--text-muted);
	--diagram-fill: var(--surface);
	--diagram-tint: color-mix(in srgb, var(--accent) 12%, var(--surface));
}
```

## Pattern: Serve A Diagram As An SVG File

The string `toSVG` returns is a complete SVG document, so a request handler can answer with it
directly, for an `<img>` source, a feed or a download.

```typescript
import { toSVG } from "@sdxc/diagram";
import { isFailure } from "@sdxc/result";

async function handle(request: Request): Promise<Response> {
	let result = toSVG(await request.text());
	if (isFailure(result)) {
		return Response.json(
			{ reason: result.error.reason, line: result.error.line, column: result.error.column },
			{ status: 422 },
		);
	}
	return new Response(result.data, {
		headers: { "Content-Type": "image/svg+xml" },
	});
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
