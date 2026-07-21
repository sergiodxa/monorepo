/**
 * A typography layer wrapping already-rendered markdown or HTML content —
 * headings, paragraphs, lists, code, tables, and rules arrive as ordinary
 * nested markup, and this component supplies every size, weight, spacing,
 * and color decision for them from the outside, entirely through three
 * custom properties: `--ui-typeset-size` (the body copy size every other
 * measurement scales from), `--ui-typeset-leading` (the body line height),
 * and `--ui-typeset-flow` (the vertical rhythm between block-level
 * elements). A `data-preset` attribute swaps all three at once for a
 * different rhythm context, and a `data-not-typeset` attribute on any
 * descendant lets a subtree opt out of the whole layer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { css } from "remix/ui";

import { easings } from "../animations/tokens";

/**
 * Named container {@link Typeset} declares on its own host, so its wide-table
 * handling can grant roomier cell and code-block padding once there's enough
 * space, instead of reading the viewport.
 */
const CONTAINER_NAME = "ui-typeset";

/** Rhythm context {@link Typeset} falls back to when `preset` is omitted. */
const DEFAULT_PRESET: Typeset.Preset = "docs";

/** CSS length each edge of a wide table's own fade tapers over. */
const TABLE_FADE_SIZE = "2.5rem";

/**
 * Custom property carrying the gradient direction a wide table's edge fade
 * paints along, mirrored under `:dir(rtl)` so the same mask string works in
 * both writing directions without a second, mirrored gradient.
 */
const TABLE_FADE_DIRECTION_PROPERTY = "--ui-typeset-table-fade-direction";

/** `@keyframes` name backing a wide table's scroll-linked edge fade. */
const TABLE_FADE_KEYFRAMES_NAME = "ui-typeset-table-fade";

/** Proportion of a wide table's own scroll range its edge fade ramps across. */
const TABLE_FADE_RAMP_PERCENT = 10;

/** The style shape {@link css} accepts, reused so a keyframes block can be built ahead of the call. */
type Styles = Parameters<typeof css>[0];

/**
 * Builds the four-stop mask-image gradient a wide table's edge fade paints
 * in every state: a leading stop, two middle stops marking where a faded
 * band gives way to the fully opaque middle, and a trailing stop. Only the
 * two middle stops ever move between states, so every state shares this same
 * four-stop shape.
 */
function tableFadeMask(startStop: string, endStop: string): string {
	return `linear-gradient(to var(${TABLE_FADE_DIRECTION_PROPERTY}, right), transparent 0%, black ${startStop}, black ${endStop}, transparent 100%)`;
}

const TABLE_FADE_SETTLED_STOP = `calc(100% - ${TABLE_FADE_SIZE})`;
const TABLE_FADE_SETTLED_MASK = tableFadeMask(TABLE_FADE_SIZE, TABLE_FADE_SETTLED_STOP);

// Built as its own statement rather than inline inside the `css()` call: an
// object literal mixing a computed key with literal ones widens past what
// `css()`'s style type accepts, where an already-typed variable assigned
// into afterward does not.
let tableFadeKeyframes: Styles = {
	"0%": { maskImage: tableFadeMask("0%", TABLE_FADE_SETTLED_STOP) },
	"100%": { maskImage: tableFadeMask(TABLE_FADE_SIZE, "100%") },
};
tableFadeKeyframes[`${TABLE_FADE_RAMP_PERCENT}%, ${100 - TABLE_FADE_RAMP_PERCENT}%`] = {
	maskImage: TABLE_FADE_SETTLED_MASK,
};

/**
 * Prop types for {@link Typeset}.
 */
export namespace Typeset {
	/**
	 * Rhythm context, each mapped to its own `--ui-typeset-size`,
	 * `--ui-typeset-leading`, and `--ui-typeset-flow` values: `"docs"` is the
	 * spacious default suited to a documentation page, `"chat"` tightens the
	 * scale and rhythm for a conversational bubble's denser turn-taking, and
	 * `"reading"` opens both further for a long-form article.
	 */
	export type Preset = "docs" | "chat" | "reading";

	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * `preset` selects the rhythm context and defaults to
	 * {@link DEFAULT_PRESET}; setting `--ui-typeset-size`,
	 * `--ui-typeset-leading`, or `--ui-typeset-flow` directly (through a style
	 * attribute or `mix`) overrides whatever the active preset supplies for
	 * that one property. Any descendant carrying `data-not-typeset` renders
	 * with no styling from this layer at all, itself and everything nested
	 * inside it.
	 */
	export interface Props extends TagProps<"div"> {
		/** Rhythm context. Defaults to {@link DEFAULT_PRESET}. */
		preset?: Preset;
	}
}

/**
 * Renders a `<div>` that sizes and colors already-rendered markdown or HTML
 * content nested inside it — headings, paragraphs, lists, blockquotes, inline
 * and block code, tables, and horizontal rules — entirely through the
 * `--ui-typeset-size`, `--ui-typeset-leading`, and `--ui-typeset-flow` custom
 * properties, read either from the active `data-preset` or overridden
 * directly. Heading sizes are computed from `--ui-typeset-size` with `calc()`
 * rather than relative `em` units, so a heading nested inside a list or
 * blockquote scales from the one shared size instead of compounding against
 * whatever font-size its ancestor already carries. Vertical rhythm rides
 * `--ui-typeset-flow` as a plain `em` length applied through the classic
 * "owl" selector (`& > * + *`), so it naturally scales with each element's
 * own font-size — a heading gets a proportionally larger gap before it with
 * no extra property needed.
 *
 * List markers keep their `list-style-type` restored to a real value rather
 * than the catalog-wide reset's `none`, which doubles as what keeps a list
 * announced with its native list role in browsers that otherwise drop it
 * once `list-style` computes to `none`.
 *
 * A table wider than the space available becomes its own scrolling region —
 * `display: block` over `overflow: auto` lets the table's own inner grid
 * lay out at its natural width while only that element scrolls, leaving the
 * rest of the content reflowing normally — carrying the same scrollbar
 * treatment (a thin, inset native scrollbar with a matching WebKit thumb) and
 * the same scroll-linked mask-image edge fade used for other scrollable
 * regions in this catalog, applied directly to the table itself since this
 * component styles markup it doesn't render and so can't wrap element by
 * element. Both fade edges render as a permanent, static taper as their own
 * baseline, tightening or opening as the table actually scrolls in a browser
 * that supports scroll-driven animation.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the typeset layer's markup.
 * @example
 * <Typeset preset="reading">{renderedArticleHtml}</Typeset>
 * @example
 * <Typeset preset="chat">
 * 	<p>{t("assistant.reply")}</p>
 * </Typeset>
 * @example
 * <Typeset>
 * 	<p>{t("docs.intro")}</p>
 * 	<div data-not-typeset>
 * 		<EmbeddedWidget />
 * 	</div>
 * </Typeset>
 */
export function Typeset(handle: Handle<Typeset.Props>) {
	return () => {
		let { preset, mix, ...rest } = handle.props;
		let resolvedPreset = preset ?? DEFAULT_PRESET;

		return (
			<div
				{...rest}
				data-preset={resolvedPreset}
				data-slot="typeset"
				mix={[
					css({
						fontSize: "var(--ui-typeset-size, 1rem)",
						lineHeight: "var(--ui-typeset-leading, 1.75)",
						color: "var(--ui-neutral-fg-emphasis)",
						container: `${CONTAINER_NAME} / inline-size`,

						'&[data-preset="docs"]': {
							"--ui-typeset-size": "1rem",
							"--ui-typeset-leading": "1.75",
							"--ui-typeset-flow": "1.25em",
						},
						'&[data-preset="chat"]': {
							"--ui-typeset-size": "0.9375rem",
							"--ui-typeset-leading": "1.5",
							"--ui-typeset-flow": "0.75em",
						},
						'&[data-preset="reading"]': {
							"--ui-typeset-size": "1.125rem",
							"--ui-typeset-leading": "1.8",
							"--ui-typeset-flow": "1.5em",
						},

						// Vertical rhythm: the classic "owl" selector spaces any two
						// adjacent elements apart, at any depth the flow needs to reach
						// (the root's own direct children, plus a blockquote's or list
						// item's own stacked children), and never touches a lone or
						// leading element since it has no preceding sibling to match.
						"& > * + *": {
							marginBlockStart: "var(--ui-typeset-flow, 1.25em)",
						},
						"& :where(blockquote, li) > * + *": {
							marginBlockStart: "var(--ui-typeset-flow, 1.25em)",
						},

						// Headings
						"& :where(h1, h2, h3, h4, h5, h6)": {
							fontWeight: 600,
							lineHeight: "1.25",
							letterSpacing: "-0.025em",
							color: "var(--ui-neutral-fg-emphasis)",
						},
						"& :where(h1)": {
							fontSize: "calc(var(--ui-typeset-size, 1rem) * 2)",
						},
						"& :where(h2)": {
							fontSize: "calc(var(--ui-typeset-size, 1rem) * 1.5)",
						},
						"& :where(h3)": {
							fontSize: "calc(var(--ui-typeset-size, 1rem) * 1.25)",
						},
						"& :where(h4)": {
							fontSize: "calc(var(--ui-typeset-size, 1rem) * 1.125)",
						},
						"& :where(h5)": {
							fontSize: "var(--ui-typeset-size, 1rem)",
						},
						"& :where(h6)": {
							fontSize: "calc(var(--ui-typeset-size, 1rem) * 0.875)",
							color: "var(--ui-neutral-fg)",
						},

						// Lists
						"& :where(ul, ol)": {
							paddingInlineStart: "1.5em",
						},
						"& :where(ul)": {
							listStyleType: "disc",
						},
						"& :where(ol)": {
							listStyleType: "decimal",
						},
						"& :where(ul, ol) :where(ul)": {
							listStyleType: "circle",
						},
						"& :where(li)::marker": {
							color: "var(--ui-neutral-fg-muted)",
						},

						// Blockquote
						"& :where(blockquote)": {
							paddingInlineStart: "1em",
							borderInlineStartWidth: "0.25em",
							borderInlineStartStyle: "solid",
							borderInlineStartColor: "var(--ui-neutral-border)",
							color: "var(--ui-neutral-fg)",
							fontStyle: "italic",
						},

						// Rules
						"& :where(hr)": {
							borderBlockStartWidth: "1px",
							borderBlockStartStyle: "solid",
							borderBlockStartColor: "var(--ui-neutral-border)",
						},

						// Links
						"& :where(a)": {
							color: "var(--ui-primary-fg)",
							textDecorationLine: "underline",
							textUnderlineOffset: "0.15em",
						},
						"& :where(a):hover": {
							textDecorationThickness: "2px",
						},
						"& :where(a):focus-visible": {
							outlineWidth: "2px",
							outlineStyle: "solid",
							outlineOffset: "2px",
							outlineColor: "var(--ui-primary-ring)",
							borderRadius: "var(--ui-radius-xs, 0.125rem)",
						},

						// Emphasis
						"& :where(strong, b)": {
							fontWeight: 600,
							color: "var(--ui-neutral-fg-emphasis)",
						},
						"& :where(em, i)": {
							fontStyle: "italic",
						},

						// Code
						"& :where(code)": {
							fontSize: "0.875em",
							paddingInline: "0.3em",
							paddingBlock: "0.15em",
							borderRadius: "var(--ui-radius-sm, 0.25rem)",
							backgroundColor: "var(--ui-neutral-bg-tint)",
							color: "var(--ui-neutral-fg-emphasis)",
						},
						"& :where(pre)": {
							overflow: "auto",
							borderRadius: "var(--ui-radius-md, 0.375rem)",
							borderWidth: "1px",
							borderStyle: "solid",
							borderColor: "var(--ui-neutral-border)",
							backgroundColor: "var(--ui-neutral-bg-tint)",
							paddingInline: "1em",
							paddingBlock: "0.875em",
							fontSize: "0.875em",
							lineHeight: "1.6",
							color: "var(--ui-neutral-fg-emphasis)",
						},
						"& :where(pre code)": {
							backgroundColor: "transparent",
							padding: "0",
							borderRadius: "0",
							fontSize: "1em",
							color: "inherit",
						},

						// Tables — a table wider than its container becomes its own
						// scrolling region, carrying the scroll area viewport's own
						// scrollbar treatment and a scroll-linked edge fade rather than
						// a differently styled scrollbar of its own.
						"& :where(table)": {
							display: "block",
							inlineSize: "max-content",
							maxInlineSize: "100%",
							overflow: "auto",
							borderCollapse: "collapse",
							fontSize: "0.875em",
							scrollbarWidth: "thin",
							scrollbarGutter: "stable",

							[TABLE_FADE_DIRECTION_PROPERTY]: "right",
							maskImage: TABLE_FADE_SETTLED_MASK,
							"-webkit-mask-image": TABLE_FADE_SETTLED_MASK,

							"&:dir(rtl)": {
								[TABLE_FADE_DIRECTION_PROPERTY]: "left",
							},

							"&::-webkit-scrollbar": {
								width: "0.75rem",
								height: "0.75rem",
							},
							"&::-webkit-scrollbar-track": {
								backgroundColor: "transparent",
							},
							"&::-webkit-scrollbar-thumb": {
								borderRadius: "var(--ui-radius-full, 9999px)",
								backgroundColor: "var(--ui-neutral-border)",
								borderWidth: "3px",
								borderStyle: "solid",
								borderColor: "transparent",
								backgroundClip: "content-box",
							},
							"&::-webkit-scrollbar-thumb:hover": {
								backgroundColor: "var(--ui-neutral-border-strong)",
							},

							"@supports (animation-timeline: scroll())": {
								animationName: TABLE_FADE_KEYFRAMES_NAME,
								animationDuration: "auto",
								animationTimingFunction: easings.linear,
								animationFillMode: "both",
								animationTimeline: "scroll(self inline)",
								[`@keyframes ${TABLE_FADE_KEYFRAMES_NAME}`]: tableFadeKeyframes,
								// A mask fade ramping in and out at each edge has no
								// positional movement to collapse to opacity — the closest
								// reduced-motion equivalent is to stop tying the fade to
								// scroll position and let both edges settle into the same
								// permanently faded state the static mask above already sets.
								"@media (prefers-reduced-motion: reduce)": {
									animationName: "none",
									maskImage: TABLE_FADE_SETTLED_MASK,
									"-webkit-mask-image": TABLE_FADE_SETTLED_MASK,
								},
							},
						},
						"& :where(th, td)": {
							paddingInline: "0.75em",
							paddingBlock: "0.5em",
							borderBlockEndWidth: "1px",
							borderBlockEndStyle: "solid",
							borderBlockEndColor: "var(--ui-neutral-border)",
						},
						// Left unaligned so a pre-existing `align` attribute — the
						// alignment a markdown-to-HTML pipeline typically bakes into a
						// GFM table's cells — keeps working: the browser's own
						// presentational hint for `align` sits beneath any author
						// declaration, so an unconditional `text-align` here would
						// silently override it.
						"& :where(th, td):not([align])": {
							textAlign: "start",
						},
						"& :where(th)": {
							fontWeight: 600,
							color: "var(--ui-neutral-fg-emphasis)",
						},

						// Once there's enough room, cells and code blocks read better
						// with roomier padding than the narrow default above.
						[`@container ${CONTAINER_NAME} (min-width: 30rem)`]: {
							"& :where(th, td)": {
								paddingInline: "1em",
							},
							"& :where(pre)": {
								paddingInline: "1.25em",
							},
						},

						// Opt-out: anything carrying `data-not-typeset`, and everything
						// nested inside it, renders with none of the styling above. Every
						// selector in this layer stays wrapped in `:where(...)` so this
						// reset — which must win by appearing last, not by outweighing
						// anything on specificity — reliably does.
						"& :where([data-not-typeset], [data-not-typeset] *)": {
							all: "revert-layer",
						},
					}),
					mix,
				]}
			/>
		);
	};
}
