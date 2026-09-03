/**
 * A typography layer wrapping already-rendered markdown or HTML content and
 * supplying every size, weight, spacing, and color decision through three
 * custom properties: `--ui-typeset-size`, `--ui-typeset-leading`, and
 * `--ui-typeset-flow`. `data-preset` swaps all three for a different rhythm
 * context; `data-not-typeset` opts a subtree out of the whole layer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { keyframes } from "@sdxc/u/animation";
import { bg, border, borderEdge, fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { block, container } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { at } from "@sdxc/u/responsive";
import { is, maxIs, pb, pi, pis } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { leading, textAlign, textDecoration, tracking, weight } from "@sdxc/u/typography";
import { css } from "remix/ui";

import { easings } from "../animations/tokens.js";

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

/**
 * `@keyframes` name backing a wide table's scroll-linked edge fade; the
 * `keyframes()` call using it must stay a top-level mixin rather than nested
 * under the table selector, since the serializer only recognizes stops there.
 */
const TABLE_FADE_KEYFRAMES_NAME = "ui-typeset-table-fade";

/** Proportion of a wide table's own scroll range its edge fade ramps across. */
const TABLE_FADE_RAMP_PERCENT = 10;

/** The style shape {@link css} accepts, reused so a keyframes block can be built ahead of the call. */
type Styles = Parameters<typeof css>[0];

/**
 * Builds the four-stop mask-image gradient a wide table's edge fade paints:
 * a leading stop, two middle stops marking where the faded band meets the
 * fully opaque middle, and a trailing stop; only the middle stops move.
 */
function tableFadeMask(startStop: string, endStop: string): string {
	return `linear-gradient(to var(${TABLE_FADE_DIRECTION_PROPERTY}, right), transparent 0%, black ${startStop}, black ${endStop}, transparent 100%)`;
}

const TABLE_FADE_SETTLED_STOP = `calc(100% - ${TABLE_FADE_SIZE})`;
const TABLE_FADE_SETTLED_MASK = tableFadeMask(TABLE_FADE_SIZE, TABLE_FADE_SETTLED_STOP);

/**
 * Stops the wide-table edge fade animates through: fully faded on the leading
 * edge at rest, settled on both edges across the long middle of the scroll
 * range, and fully faded on the trailing edge at the end.
 */
const TABLE_FADE_KEYFRAMES: Record<string, Styles> = {
	"0%": { maskImage: tableFadeMask("0%", TABLE_FADE_SETTLED_STOP) },
	[`${TABLE_FADE_RAMP_PERCENT}%, ${100 - TABLE_FADE_RAMP_PERCENT}%`]: {
		maskImage: TABLE_FADE_SETTLED_MASK,
	},
	"100%": { maskImage: tableFadeMask(TABLE_FADE_SIZE, "100%") },
};

/**
 * Prop types for {@link Typeset}.
 */
export namespace Typeset {
	/**
	 * Rhythm context: `"docs"` is the spacious default, `"chat"` tightens the
	 * scale for a conversational bubble's denser turn-taking, and `"reading"`
	 * opens both further for a long-form article.
	 */
	export type Preset = "docs" | "chat" | "reading";

	/**
	 * Every native `<div>` attribute plus `mix`. `preset` defaults to
	 * {@link DEFAULT_PRESET}; setting a `--ui-typeset-*` property directly
	 * overrides it, and `data-not-typeset` opts a subtree out entirely.
	 */
	export interface Props extends TagProps<"div"> {
		/** Rhythm context. Defaults to {@link DEFAULT_PRESET}. */
		preset?: Preset;
	}
}

/**
 * Renders a `<div>` that sizes and colors already-rendered markdown or HTML
 * content through `--ui-typeset-size`, `--ui-typeset-leading`, and
 * `--ui-typeset-flow`, computing heading sizes via `calc()` off one shared value.
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
					fg("neutral.emphasis"),
					container(CONTAINER_NAME),
					keyframes(TABLE_FADE_KEYFRAMES_NAME, TABLE_FADE_KEYFRAMES),
					raw({
						fontSize: "var(--ui-typeset-size, 1rem)",
						lineHeight: "var(--ui-typeset-leading, 1.75)",

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

						"& > * + *": {
							marginBlockStart: "var(--ui-typeset-flow, 1.25em)",
						},
						"& :where(blockquote, li) > * + *": {
							marginBlockStart: "var(--ui-typeset-flow, 1.25em)",
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

						"& :where(blockquote)": {
							fontStyle: "italic",
						},

						"& :where(a)": {
							textUnderlineOffset: "0.15em",
						},
						"& :where(a):hover": {
							textDecorationThickness: "2px",
						},

						"& :where(em, i)": {
							fontStyle: "italic",
						},

						"& :where(code)": {
							fontSize: "0.875em",
						},
						"& :where(pre)": {
							fontSize: "0.875em",
						},
						"& :where(pre code)": {
							padding: "0",
							fontSize: "1em",
						},

						"& :where(table)": {
							borderCollapse: "collapse",
							fontSize: "0.875em",
							scrollbarWidth: "thin",
							scrollbarGutter: "stable",

							[TABLE_FADE_DIRECTION_PROPERTY]: "right",
							maskImage: "none",
							"-webkit-mask-image": "none",

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
								"@media (prefers-reduced-motion: reduce)": {
									animationName: "none",
									maskImage: TABLE_FADE_SETTLED_MASK,
									"-webkit-mask-image": TABLE_FADE_SETTLED_MASK,
								},
							},
						},
						"& :where([data-not-typeset], [data-not-typeset] *)": {
							all: "revert-layer",
						},
					}),

					at(
						"30rem",
						CONTAINER_NAME,
						raw({
							"& :where(th, td)": {
								paddingInline: "1em",
							},
							"& :where(pre)": {
								paddingInline: "1.25em",
							},
						}),
					),

					when("& :where(pre)", leading(1.6)),

					when("& :where(h1, h2, h3, h4, h5, h6)", [
						weight("semibold"),
						leading(1.25),
						tracking("tight"),
						fg("neutral.emphasis"),
					]),
					when("& :where(h6)", fg("neutral")),

					when("& :where(ul, ol)", pis("1.5em")),
					when("& :where(li)::marker", fg("neutral.muted")),

					when("& :where(blockquote)", [
						pis("1em"),
						fg("neutral"),
						borderEdge("inline-start", { color: "neutral", width: "0.25em" }),
					]),

					when("& :where(hr)", borderEdge("block-start", { color: "neutral", width: "1px" })),

					when("& :where(a)", [fg("brand"), textDecoration("underline")]),
					when("& :where(a):focus-visible", [
						outline({ color: "brand.ring", offset: 2 }),
						rounded("xs"),
					]),

					when("& :where(strong, b)", [weight("semibold"), fg("neutral.emphasis")]),

					when("& :where(code)", [
						rounded("sm"),
						bg("neutral.tint"),
						fg("neutral.emphasis"),
						pi("0.3em"),
						pb("0.15em"),
					]),
					when("& :where(pre)", [
						rounded("md"),
						border({ color: "neutral.border", width: 1 }),
						bg("neutral.tint"),
						fg("neutral.emphasis"),
						pi("1em"),
						pb("0.875em"),
						overflow("auto"),
					]),
					when("& :where(pre code)", [bg("transparent"), fg("inherit"), rounded("none")]),

					when("& :where(table)", [
						block(),
						is("max(100%, max-content)"),
						maxIs("full"),
						overflow("auto"),
					]),
					when("& :where(th, td):not([align])", textAlign("start")),
					when("& :where(th)", [weight("semibold"), fg("neutral.emphasis")]),
					when("& :where(th, td)", [
						pi("0.75em"),
						pb("0.5em"),
						borderEdge("block-end", { color: "neutral", width: "1px" }),
					]),

					mix,
				]}
			/>
		);
	};
}
