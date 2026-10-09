# ADR-126: Diagram Package

## Status

**Implemented** - 2026-10-08

## Background

Guides and blog posts explain systems, and some explanations are diagrams: a request crossing
services, a class hierarchy, the states a record moves through. Markdown in this repo has no way
to draw one. GitHub renders a fenced block marked `mermaid` as a diagram, so an author who
writes one gets a picture on GitHub and a code block everywhere this repo renders the same file.

This ADR adds `@sdxc/diagram`: a reader for Mermaid's text syntax, a layout engine, an SVG
writer, a walk visitor for markdown, and renderers for the nodes the visitor leaves.

## Context

### What the Mermaid library costs

Mermaid itself lays diagrams out in the browser: it measures text with the DOM, ships megabytes
of JavaScript across its diagram kinds and its layout dependencies, and draws after the page
loads. Rendering it on the server needs a headless browser, which a Worker does not have.
PlantUML, the other common text format for UML, needs a JVM or a call to a third-party server.

### What authors draw

Technical writing reaches for four kinds: sequence diagrams for interactions, class diagrams for
models, state diagrams for lifecycles, and flowcharts for everything else. Three are UML; the
fourth is Mermaid's most-used kind and covers activity-style diagrams. Each needs only a slice of
Mermaid's syntax.

### What markdown gives a visitor

`@sdxc/markdown` parses a fenced block marked `mermaid` as a `code` node with
`language: "mermaid"`. A handler that throws fails the walk with a `MarkdownWalkError` carrying
the node's position and the thrown value as `cause`. The renderers draw a registered tag through `toHTML`'s `tags` option
and `toRemix`'s `components` option, keyed by tag name.

## Decision

Create `@sdxc/diagram` with three entry points:

| Entry                    | Exports                                                     | Depends on                        |
| ------------------------ | ----------------------------------------------------------- | --------------------------------- |
| `@sdxc/diagram`          | `parseDiagram`, `toSVG`, `DiagramError`, the SVG tree types | `@sdxc/result`                    |
| `@sdxc/diagram/markdown` | `diagram`, `createDiagramVisitor`, `renderDiagram`          | `@sdxc/markdown` (types and html) |
| `@sdxc/diagram/ui`       | `Diagram`, `DiagramTag` (`remix/component` components)      | `remix/component`                 |

### Mermaid syntax, four kinds

The header line picks the kind: `sequenceDiagram`, `classDiagram`, `stateDiagram(-v2)`, or
`flowchart`/`graph` with a direction. Each kind has a line-oriented reader for the subset the
README lists; every statement outside it is a `DiagramError` naming the statement, so a diagram
never renders with a silently dropped line. Statements that only style a diagram (`classDef`,
`style`, `linkStyle`, `click`, `:::class`) are read and skipped, because the drawing takes the
page's colors.

Choosing Mermaid's syntax keeps one source rendering on GitHub and here alike, which is the same
reason `@sdxc/math` reads GitHub's math forms.

### Layout on the server

Text is measured from per-character width classes of a typical sans-serif face, erring wide, so
layout needs no font and no DOM and the output is identical on every run.

Sequence diagrams have a fixed geometry: columns sized so every box, message label, note and
self-message fits, and events stacked top to bottom.

The other three kinds share a layered layout: cycles broken by a depth-first search, longest-path
ranking, barycenter sweeps that keep the ordering with the fewest crossings, and placement across
the flow by weighted isotonic regression, which moves each rank as little as possible toward its
neighbors while keeping every gap. Every rank is doubled, so every edge has a midpoint vertex that
reserves room for its label. Groups (subgraphs, namespaces, composite states) are laid out inside
out, each placed in its parent as one node; an edge between groups is routed between the members
that hold its ends and then ends on the nodes it names.

### SVG as a JSON tree

`parseDiagram` returns the drawing as a JSON tree of SVG elements, and `toSVG` serializes it with
every value escaped and every element explicitly closed. The component builds the same tree with
`createElement`, so the string and the component cannot disagree, and SVG elements render on the
server and in the browser alike.

Lines and text use `currentColor`; fills use `--diagram-fill` and `--diagram-tint`, which fall
back to `Canvas` and a `color-mix` of it. A diagram therefore takes its color from the
surrounding text and follows the page's color scheme with no stylesheet. Arrowheads are drawn as
shapes rather than markers, so a page with several diagrams has no `id` to collide. The root is
`role="img"` and carries a `title` (from `title`, `accTitle` or frontmatter, else the kind's
name) and a `desc` from `accDescr`.

### Tag nodes instead of teaching `@sdxc/markdown` about diagrams

The visitor replaces a mermaid fence with a block `tag` node named `diagram` carrying
`{ source }`. The renderers that already draw registered tags then draw it: `renderDiagram` for
`toHTML`, `DiagramTag` for `toRemix`. `@sdxc/markdown` stays free of a diagram grammar and a
layout engine it would carry for every consumer.

### Invalid diagrams fail the walk by default

The visitor parses each diagram while walking and throws the `DiagramError`, so a broken diagram
stops a build with the fence's position and the statement's line and column.
`createDiagramVisitor({ invalid: "keep" })` leaves the code block instead, for previews.
`renderDiagram` and `Diagram` render source that does not parse as escaped code.

## Consequences

### Positive

- A diagram written for GitHub renders the same everywhere this repo renders markdown.
- No client script, stylesheet or font; the page carries finished SVG.
- A broken diagram fails CI with its line and column, by default.

### Negative

- The layout is simpler than Mermaid's: routes bend through rank midpoints, and a note or a
  group header can sit where a hand-drawn diagram would not put it.
- Text measurement is an estimate; an unusual system font can leave a label tighter or looser
  than intended.
- Other Mermaid kinds (Gantt, pie, ER, journey and the rest) and concurrent state regions fail
  until a document needs them.

### Neutral

- `@sdxc/markdown` is unchanged; diagrams are an opt-in visitor and two renderer entries.

## Alternatives Considered

### 1. Mermaid in the browser

Ship Mermaid and render on load. Rejected: megabytes of script per page, a flash of code before
the diagram, and nothing for feeds or email.

### 2. PlantUML through its server

Encode each diagram into a URL on a PlantUML server. Rejected: a third party on every build or
page view, and a format GitHub does not render.

### 3. A diagram node type in `@sdxc/markdown`

Rejected for the reasons ADR-125 rejected a math node: every consumer would carry a grammar and a
layout engine it may never use.

## References

- [Mermaid syntax reference](https://mermaid.js.org/intro/syntax-reference.html)
- [GitHub: Creating diagrams](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams)
- [ADR-125: Math Package](./ADR-125-math-package.md)
- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)

## Current Progress

- [x] `@sdxc/diagram`: sequence, class, state and flowchart readers, layered layout, SVG writer
- [x] `@sdxc/diagram/markdown`: visitor and HTML tag renderer
- [x] `@sdxc/diagram/ui`: `Diagram` and `DiagramTag`
- [ ] `bun run release:bootstrap @sdxc/diagram` and the npm trusted publisher
