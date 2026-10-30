/**
 * A single emphasized phrase inside a marketing headline — brand color, a swash, a
 * marker band, a fading sheen, or a word set in a pill or a tinted chip — so the
 * surrounding display heading stays one weight and size.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { forcedColors } from "@sdxc/u/responsive";
import { before } from "@sdxc/u/state";

/** Treatment {@link AccentText} applies when `variant` is omitted. */
const DEFAULT_VARIANT: AccentText.Variant = "color";

/** Brush stroke drawn under a swash phrase; stretched to the phrase's width. */
const SWASH_PATH =
	"M3.2 17.4C46 8.6 98 5.2 152 5.6c50 .4 98 4 143.6 10.6 1.7.3 2.5 2.1 1.3 3.1-.9.7-2.3.8-3.5.6C246 13.6 198.8 10.9 151.6 10.8 97.4 10.6 49.6 13.6 5.8 21.6c-1.7.3-3.3-.6-3.6-2.1-.1-.8.4-1.6 1-2.1Z";

/** Ink of the stressed phrase; a page that accents in another hue sets `--ui-marketing-accent-color`. */
const ACCENT = "var(--ui-marketing-accent-color, var(--ui-brand-fg))";

/** Brand at 18%, the marker ink a highlight band lays behind the glyphs. */
const MARKER = "color-mix(in oklch, var(--ui-brand-bg-solid) 18%, transparent)";

/** Per-variant styles for the treatments that only restyle the span itself. */
const SPAN_VARIANTS: Partial<Record<AccentText.Variant, Record<string, string>>> = {
	sheen: {
		backgroundImage:
			"linear-gradient(to right bottom, currentColor 30%, color-mix(in oklch, currentColor 50%, transparent))",
		backgroundClip: "text",
		WebkitBackgroundClip: "text",
		WebkitTextFillColor: "transparent",
		boxDecorationBreak: "clone",
		WebkitBoxDecorationBreak: "clone",
	},
	pill: {
		display: "inline-block",
		fontSize: "0.5em",
		lineHeight: "1.2",
		letterSpacing: "0.04em",
		textTransform: "uppercase",
		whiteSpace: "nowrap",
		verticalAlign: "0.35em",
		paddingBlock: "0.05em",
		paddingInline: "0.35em",
		border: "0.08em solid currentColor",
		borderRadius: "9999px",
	},
	chip: {
		display: "inline-flex",
		alignItems: "center",
		gap: "0.2em",
		whiteSpace: "nowrap",
		paddingInline: "0.25em",
		borderRadius: "0.25em",
		color: ACCENT,
		backgroundColor: "color-mix(in oklch, var(--ui-brand-bg-solid) 12%, transparent)",
	},
};

/**
 * Prop types for {@link AccentText}.
 */
export namespace AccentText {
	/**
	 * How the phrase is stressed: brand color, brand color over a hand-drawn swash, a
	 * marker band behind the glyphs, a `sheen` fading the ink toward the end, an
	 * outlined uppercase `pill` at half size, or a tinted `chip` led by a dot.
	 */
	export type Variant = "color" | "swash" | "highlight" | "sheen" | "pill" | "chip";

	/**
	 * Props accepted by {@link AccentText}.
	 */
	export interface Props extends TagProps<"span"> {
		/**
		 * Treatment for the phrase. `swash` keeps the phrase on one line so the
		 * stroke spans it. Defaults to {@link DEFAULT_VARIANT}.
		 */
		variant?: Variant;
		/** The emphasized phrase. */
		children: RemixNode;
	}
}

/**
 * Stresses one phrase of a display heading while the heading keeps one weight; the
 * swash, marker and chip dot are decorative, and the sheen falls back to solid ink
 * under forced colors.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the accent span.
 * @example
 * <Heading size="display">Ship <AccentText>{t("hero.accent")}</AccentText> faster</Heading>
 * @example
 * <Heading size="display">Know <AccentText variant="swash">{t("hero.accent")}</AccentText></Heading>
 * @example
 * <Heading size="display">The <AccentText variant="pill">{t("hero.tag")}</AccentText> gateway</Heading>
 */
export function AccentText(handle: Handle<AccentText.Props>) {
	return () => {
		let { children, mix, variant, ...rest } = handle.props;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;

		if (resolvedVariant === "swash") {
			return (
				<span
					{...rest}
					data-slot="accent-text"
					data-variant="swash"
					mix={[raw({ color: ACCENT, position: "relative", whiteSpace: "nowrap" }), mix]}
				>
					<svg
						aria-hidden="true"
						viewBox="0 0 300 24"
						preserveAspectRatio="none"
						mix={[
							raw({
								position: "absolute",
								insetInlineStart: "0",
								insetBlockStart: "66%",
								inlineSize: "100%",
								blockSize: "0.58em",
								fill: "color-mix(in oklch, var(--ui-brand-bg-solid) 45%, transparent)",
								pointerEvents: "none",
							}),
						]}
					>
						<path d={SWASH_PATH} />
					</svg>
					<span mix={[raw({ position: "relative" })]}>{children}</span>
				</span>
			);
		}

		let spanVariant = SPAN_VARIANTS[resolvedVariant];
		if (spanVariant) {
			return (
				<span
					{...rest}
					data-slot="accent-text"
					data-variant={resolvedVariant}
					mix={[
						raw(spanVariant),
						resolvedVariant === "chip"
							? before(
									raw({
										content: '""',
										inlineSize: "0.3em",
										blockSize: "0.3em",
										flexShrink: "0",
										borderRadius: "9999px",
										backgroundColor: "currentColor",
									}),
								)
							: [],
						resolvedVariant === "sheen"
							? forcedColors(raw({ backgroundImage: "none", WebkitTextFillColor: "currentColor" }))
							: [],
						mix,
					]}
				>
					{children}
				</span>
			);
		}

		if (resolvedVariant === "highlight") {
			return (
				<span
					{...rest}
					data-slot="accent-text"
					data-variant="highlight"
					mix={[
						raw({
							backgroundImage: `linear-gradient(transparent 60%, ${MARKER} 60%)`,
							paddingInline: "0.06em",
							boxDecorationBreak: "clone",
							WebkitBoxDecorationBreak: "clone",
						}),
						mix,
					]}
				>
					{children}
				</span>
			);
		}

		return (
			<span
				{...rest}
				data-slot="accent-text"
				data-variant="color"
				mix={[raw({ color: ACCENT }), mix]}
			>
				{children}
			</span>
		);
	};
}
