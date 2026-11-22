---
title: Tempo
headline: A utilities reference that draws what every call does, from one record per utility
summary: A reference for an invented CSS utility library, where every utility is drawn doing what it does beside its call and the CSS it emits.
cover: spacing
shots:
  - id: spacing
    page: "utilities/spacing"
    alt: The Spacing reference page, with the sidebar, the page header and the spacing scale.
  - id: pad
    page: "utilities/spacing"
    highlight: "#pad ~ figure[data-not-typeset]"
    alt: Four tiles inside hatched padding at steps 2, 4 and 8 and an inline-only pad, with the code that drew them underneath.
  - id: pad-calls
    page: "utilities/spacing"
    highlight: "table[aria-label='pad quick reference']"
    alt: The pad quick reference, each call beside the padding declaration it emits.
  - id: palettes
    page: "utilities/colour"
    highlight: "#palettes + div"
    alt: Seven palettes, stone, clay, ochre, moss, tide, ink and plum, each as a row of eleven shades.
  - id: bg-calls
    page: "utilities/colour"
    highlight: "table[aria-label='bg quick reference']"
    alt: The bg quick reference, with a swatch beside each call and its background declaration.
  - id: grid
    page: "utilities/layout"
    highlight: "#grid ~ figure[data-not-typeset]"
    alt: Two grids of numbered tiles, one from grid(3) and one from grid("6rem"), inside hatched containers with the code underneath.
  - id: type-scale
    page: "utilities/typography"
    highlight: "#the-type-scale + div"
    alt: The type scale from xs at 0.75rem to 4xl at 2.25rem, the same line set at every step.
  - id: phone
    page: "utilities/layout"
    viewport: phone
    alt: The Layout reference on a phone, with the rail bar naming stack, and the stack utility's summary and signature.
---

Tempo is an invented library of CSS utilities, and this is its reference: an installation page, a concept page on scales and tokens, and five reference pages for spacing, colour, layout, typography and effects. The library, its package name and its functions are made up. The drawings are real CSS: every utility on the site is shown doing what it does, next to the call that drew it and a table of what each call emits.

A utilities reference is a page of many small sections, and the hard part is letting a reader compare values they will never read twice. Tempo answers with pictures: a reader sees `pad(4)` reserve a hatched quarter of space before reading `padding: 1rem`. It is also worth reading for the data shape behind those pages. Each reference page is built from a list of utility records, and the page's sections, drawings, tables and rail all come from that list.

It is set in a technical register: cool neutrals, a teal-green accent, monospace headings and near-square corners.

## The brief

A utility library is learned by scale, not by function. A reader needs to see the steps of the spacing scale against each other, the shades of a palette in a row, what a layout call does to its children, and the exact CSS a call emits, because that CSS is what they will debug in the browser. They also need to find one utility among dozens on a long page, and to know how to change a scale when the defaults do not fit their product.

Tempo takes that on with a structure that repeats. Every reference page opens with an intro and any shared section, such as the scale its utilities read. Each utility then gets a monospace heading, a one-line summary, its signature, a drawing on a dotted stage with the code beneath, and a quick reference table. The two getting-started pages cover installing the package and loading its stylesheet, composing a first card, and the concept page that makes the library a team's own.

## Drawing what a call does

The spacing page draws `pad`, `margin` and `gap` in their own units. A `pad` drawing puts a tile inside padding as deep as the step and hatches that padding in the brand colour, so the space itself is the subject. Steps 2, 4 and 8 sit side by side, then `pad(0, 6)` shows inline-only padding. Margins hatch the space outside, and gaps hatch the space between tiles.

![Tiles inside hatched padding](/showcase/tempo/pad.webp "Padding is hatched at each step, so the reserved space reads before the number does.")

Every drawing sits in an `Example` from `tempo/visuals.tsx`: the preview on a dotted stage with its code underneath, so a reader compares the result and the call in one glance. Layout drawings box tiles inside a hatched container laid out by the very properties the table lists; typography sets the scale at every step; effects shows radius, shadow and opacity as tiles. Shadows only read on a light surface, so those tiles sit on a panel that stays light in dark mode.

![Tiles laid out by grid calls](/showcase/tempo/grid.webp "Layout calls are drawn with the same properties the quick reference lists.")

## The call beside the CSS it emits

Under each drawing, a quick reference table lists the documented calls and the CSS each emits: `pad(2)` is `padding: 0.5rem`, `pad(4)` is `padding: 1rem`, `pad(2, 4)` is `padding: 0.5rem 1rem`. The tables are what a reader returns to, and they are generated from the same record as the drawing, so a new call is one line.

![The pad quick reference](/showcase/tempo/pad-calls.webp "Every call sits beside the exact declaration it emits.")

Spacing steps are quarter-rems, from 0 through 1, 2, 3, 4, 6, 8, 12 and 16, and the spacing page opens with that scale drawn as a shared section before any utility: one bar per step, labelled with the rem it resolves to, so 16 reads as four times 4. The typography page opens the same way with the type scale: the line "Keep the rhythm" set at every step from `xs` (0.75rem) to `4xl` (2.25rem), each labelled with its name and size.

![The type scale set at every step](/showcase/tempo/type-scale.webp "The type scale is set at every step, so sizes compare by eye.")

## Colour as swatches that hold in both themes

The colour page opens with seven palettes, stone, clay, ochre, moss, tide, ink and plum, each an ordered list of eleven shades. A swatch is computed by `swatch(name, shade)` from the palette's hue and chroma, a lightness per shade and a chroma curve, so the ramps are consistent and the values are visible in the code. A swatch shows a value, not a role, so it resolves to the same colour in light and dark mode.

![Seven palettes of eleven shades](/showcase/tempo/palettes.webp "Seven palettes as eleven-shade ramps, computed from one hue and chroma each.")

The `bg`, `fg` and `borderColor` utilities follow, each with chips drawn in the colours they set, and their quick reference tables add a Preview column: a swatch beside each call, whose CSS reads the palette's custom property, such as `background-color: var(--tempo-tide-500)`. A table row reads as the call, the colour and the declaration together.

![The bg quick reference with swatches](/showcase/tempo/bg-calls.webp "A colour utility's table puts a swatch beside each call.")

## One record per utility

`tempo/utility-docs.tsx` defines the shape every reference page is written in. A `TempoUtility` holds the name a reader imports (which is also the section's fragment), the signature, a summary, the example's code and preview, and the calls with their CSS and an optional sample. `utilityPage()` turns a list of those into a `DemoDocsPage`: one `h2` per shared section and per utility, the utility's set in the mono face, and a table of contents that lists exactly those headings in order.

```ts
export interface TempoUtility {
	name: string;
	signature: string;
	summary: RemixNode;
	example: { code: string; column?: boolean; preview: RemixNode };
	calls: UtilityCall[];
}
```

The rail and search both read that table of contents. On a page of a dozen utilities, the "On this page" rail is how a reader finds `gap` or `opacity`, and a search for a utility's name links straight to its section. Because the heading and the rail entry come from the same record, they cannot disagree.

On a phone a long signature wraps inside its box, the rail folds into a bar naming the utility in view, and the sidebar opens from a menu.

![The Layout reference on a phone](/showcase/tempo/phone.webp "On a phone the rail becomes a bar that names the utility being read.")

## Scales a team can change

"Scales and tokens" explains that every scale is a token: change a step, bring your own palette, and dark mode follows. The installation page uses an [InstallCommand](/api/ui/install-command) remembered across pages in a cookie, loads the stylesheet, and builds a first card from the utilities. Around all of it is the frame every docs demo shares: [DocsLayout](/api/ui/docs-layout), [DocsNav](/api/ui/docs-nav) with a filter, [DocsPageHeader](/api/ui/docs-page-header), [AnchorHeading](/api/ui/anchor-heading) for every section, [PageActions](/api/ui/page-actions) with a Markdown twin per page, [DocsPager](/api/ui/docs-pager), search at `search?q=` and [DocsFeedback](/api/ui/docs-feedback) in its own frame.

## Takes after

- [Tailwind CSS](https://tailwindcss.com/docs) — a utility reference where each page pairs class names with the CSS they emit and draws spacing as hatched space; Tempo builds its pages from records.
- [Radix Colors](https://www.radix-ui.com/colors) — palettes documented as rows of swatches, one step per shade.
- [Open Props](https://open-props.style) — scales and tokens as the layer a team edits to make the library its own.

## Where to start reading

- [`resources/views/demo-docs/tempo/utility-docs.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-docs/tempo/utility-docs.tsx) — the record every utility is written as, and the page built from it.
- [`resources/views/demo-docs/tempo/visuals.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-docs/tempo/visuals.tsx) — the hatching, swatches, layout boxes and type samples.
- [`resources/views/demo-docs/tempo/reference.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-docs/tempo/reference.tsx) — the five reference pages as lists of utilities.
