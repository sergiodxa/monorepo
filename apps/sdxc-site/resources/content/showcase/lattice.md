---
title: Lattice
headline: Component docs where every example is the real component, rendered on the server beside the code that made it
summary: Docs for an invented UI library, each page opening on a live preview, then its variants, props and what a screen reader hears.
cover: button
shots:
  - id: button
    page: "components/button"
    alt: The Lattice Button page, with the sidebar, the page header and a Preview tab showing buttons on a dotted stage.
  - id: example
    page: "components/button"
    highlight: "[data-slot='code-tabs']"
    alt: A Preview tab rendering a Save changes button on a dotted stage, with a Code tab beside it.
  - id: example-code
    page: "components/button"
    click: "[data-slot='code-tabs-list'] label:nth-child(2)"
    highlight: "[data-slot='code-tabs']"
    alt: The same example switched to its Code tab, showing the markup that rendered the preview.
  - id: pending
    page: "components/button"
    highlight: "#pending ~ form[data-slot='code-tabs']"
    alt: A pending button with a spinner over its label, keeping its width.
  - id: props
    page: "components/button"
    highlight: "[data-slot='props-table']"
    alt: The Button props table with names, types and defaults.
  - id: hub
    page: ""
    highlight: "[data-slot='docs-hub-sections']"
    alt: The hub's sections grouped by job, Getting started, Actions, Status, Forms and Layout, each with one line.
  - id: tokens
    page: "getting-started/theming"
    highlight: "[data-slot='props-table']"
    alt: The theme token reference, listing the brand, neutral, radius and font tokens, with child fields behind disclosures.
  - id: phone
    page: "components/switch"
    viewport: phone
    alt: The Switch page on a phone, a live switch in its preview stage under the page header.
---

Lattice UI is an invented component library, and this is its documentation site: an installation page, a theming page, and one page each for Badge, Button, Card and Switch, with a hub that doubles as the component index. The library's name, package and stylesheet are made up. Its components are real: every preview on the site renders the actual `@sdxc/ui` [Button](/api/ui/button), [Badge](/api/ui/badge), [Card](/api/ui/card) or [Switch](/api/ui/switch), on the server, inside the page.

That makes Lattice a study in the component page, the most copied page shape in front-end docs. It shows the order a reader asks in (what does it look like, what are my options, what props, what does a screen reader hear) and a Preview and Code pattern built from the same [CodeTabs](/api/ui/code-tabs) the rest of the docs kit uses for package managers and languages.

It is set crisp and monochrome: true greys, one violet accent, a geometric sans and small radii, all from tokens on the demo's theme wrapper.

## The brief

A component library's docs carry more weight than most. A reader decides whether to adopt the library from the first example, and they come back daily to look up a prop. The hard parts are showing the component working without a separate playground, keeping the code shown identical to what renders, documenting variants without a wall of screenshots, and writing accessibility down as behaviour a reader can check.

Lattice takes those on in four pages that share one structure. Each opens on a usage example, walks variants, colours, sizes and states with a preview apiece, then lists every prop in a table and closes on accessibility notes. Installation and Theming cover the two things a team does once. The hub groups components by the job they do, so a reader looking for "something to show status" finds Badge without knowing its name.

## Preview first, code one tab over

Every example is an `Example` from `lattice/preview.tsx`: a [CodeTabs](/api/ui/code-tabs) strip whose first tab, Preview, renders the component on a dotted stage, and whose second, Code, holds the markup as a highlighted [CodeBlock](/api/ui/code-block) with a copy button. The Button page opens on one, and the page has an example per variant, colour, size and icon pairing below it.

![A Preview tab rendering a button on a dotted stage](/showcase/lattice/example.webp "Each example opens on the rendered component, drawn on a dotted stage so its edges read.")

The tabs are radio inputs inside a form, so switching works with CSS alone and needs no script to read the code. The example strips use `persist="none"`: they are independent of each other, where the package-manager line on the installation page is remembered across the site in a cookie.

![The same example switched to its Code tab](/showcase/lattice/example-code.webp "One tab over, the exact markup that produced the preview, ready to copy.")

The stage wraps its children in a [HeadingScope](/api/ui/heading-scope) at level four. A previewed [Card](/api/ui/card) draws a title, and without the scope that title would be an `h2` beside the page's own sections; inside it the card's heading starts at `h4`, so the page outline and the "On this page" rail stay about the page.

```tsx
<HeadingScope
	level={4}
	mix={[
		raw({
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			justifyContent: "safe center",
			gap: "0.75rem",
			minInlineSize: 0,
		}),
	]}
>
	{children}
</HeadingScope>
```

## Variants and states as sections

The Button page runs Usage, Variants (solid, surface, outline, ghost), Colors, Sizes, With an icon and Pending, each a heading the rail lists and each with its own example. Because the previews are live, a state is the component in that state. The pending example renders `<Button isPending>Saving…</Button>`: the spinner sits over the label and the button keeps its width, which the page text points out and the preview shows.

![A pending button with a spinner over its label](/showcase/lattice/pending.webp "The pending state is the live component, spinner over the label and width held.")

Switch has a "States" section with off, on, disabled and locked-on side by side, and an "In a form" section that shows a switch posting with a plain form and a submit [Button](/api/ui/button). Card has an anatomy section and a coloured variant; Badge walks its variants and colours.

## Props written as a table with depth

Each component's API reference is a [PropsTable](/api/ui/props-table) through the shared `Fields` block: name, type, default and a description, with child rows behind a "Show child fields" disclosure that opens in place. The Switch table lists `children`, `defaultChecked` and `disabled`, then a `--ui-switch-*` row whose children are the three custom properties that size the track and thumb. A reader sees the JavaScript props and the CSS ones in one place.

![The Button props table](/showcase/lattice/props.webp "Props, types and defaults in one table, with nested rows that open in place.")

Under the table, the accessibility notes are behaviour. Button renders a native `<button>`, so Enter and Space activate it; a pending button sets `aria-busy` and stays focusable; an icon-only button needs `aria-label`. Switch renders `<input type="checkbox" role="switch">` and is announced as "switch, on" or "switch, off".

On a phone the preview stage scrolls sideways inside itself when a row of components is wider than the screen, and the page around it stays put.

![The Switch page on a phone](/showcase/lattice/phone.webp "On a phone the live preview stays first, under the page header.")

## A hub that indexes by job, and theming by tokens

The root is a [DocsHub](/api/ui/docs-hub) titled "Components that render on the server". Its start cards lead to Installation, Theming and Button; its topic row names every component plus Dark mode; and its sections group the components by what they are for: Actions, Status, Forms and Layout, each with one line, such as "Badge: say what state a record is in."

![The hub's sections grouped by job](/showcase/lattice/hub.webp "The hub sorts components by the job a reader came to do, one line each.")

Installation pairs an [InstallCommand](/api/ui/install-command) for `@lattice/ui` with the step to load the stylesheet and a first render. Theming makes one argument: override tokens in your own stylesheet, after the library's, with no theme object and nothing to recompile. It shows setting the brand scale, scoping a theme to one element such as a promotional band, and dark mode following the system with each semantic token re-reading the scale. Its token reference lists the brand, neutral, radius and font tokens, and nests the steps components read under `--ui-color-brand-*` behind a "Show child fields" disclosure: 500 for focus rings and 600 for solid fills and links.

![The theme token reference](/showcase/lattice/tokens.webp "The token reference keeps each scale on one row, its individual steps one disclosure away.")

The demo theme itself proves the point: Lattice's violet and its radii come from the same kind of token overrides the page describes, set on one wrapper around the docs.

## The shared docs frame

Everything outside the article comes from the shell every docs demo shares: [DocsLayout](/api/ui/docs-layout) with a [DocsNav](/api/ui/docs-nav) that filters pages and marks Switch as New, a [DocsPageHeader](/api/ui/docs-page-header) whose title is set in the monospace face because a component name is something a reader types, [PageActions](/api/ui/page-actions) with a Markdown twin of every page, [NextSteps](/api/ui/next-steps), a [DocsPager](/api/ui/docs-pager), search at `search?q=` and a [DocsFeedback](/api/ui/docs-feedback) form served as its own frame. The page renders completely before any script loads; the runtime adds copy buttons, the rail's marker and the feedback frame's partial reload.

## Takes after

- [shadcn/ui](https://ui.shadcn.com/docs) — the Preview and Code tabs that open every component page, and examples grouped by variant below; Lattice renders its previews on the server.
- [Radix Primitives](https://www.radix-ui.com/primitives/docs/overview/introduction) — an API reference table per component, closed by keyboard and screen-reader behaviour.
- [Geist](https://vercel.com/geist/introduction) — the monochrome palette with a single accent and a geometric sans.

## Where to start reading

- [`resources/views/demo-docs/lattice/preview.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-docs/lattice/preview.tsx) — the Preview and Code example and its heading scope.
- [`resources/views/demo-docs/lattice/components.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-docs/lattice/components.tsx) — the four component pages in one shape.
- [`resources/views/demo-docs/blocks.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-docs/blocks.tsx) — the headings, code, install lines, asides and field tables every docs demo writes with.
