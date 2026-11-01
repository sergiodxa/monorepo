/**
 * A docs aside for the one thing a reader must not miss: a note, a tip, a warning or a
 * danger, tinted lightly in its kind's colour and opened by the kind's icon and label.
 * It is static content present at load, so it is a named `<aside>` and never a live region.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { InfoIcon, LightbulbIcon, OctagonAlertIcon, TriangleAlertIcon } from "@sdxc/icons";
import { bg, border, colorMix, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { mergeMix } from "@sdxc/u/general";
import { hstack, inlineFlex, vstack } from "@sdxc/u/layout";
import { m, minIs, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { leading, overflowWrap, text, weight } from "@sdxc/u/typography";

import type { SemanticColor } from "../utils/semantic-color.js";

/**
 * Prop types for {@link Callout}.
 */
export namespace Callout {
	/**
	 * How serious the aside is, from adding context to warning of loss. Each kind draws
	 * its own icon as well as its own colour, so kinds read apart without colour.
	 */
	export type Kind = "note" | "tip" | "warning" | "danger";

	/**
	 * Native `<aside>` attributes plus the kind, its translated label and an optional title.
	 */
	export interface Props extends Omit<TagProps<"aside">, "title"> {
		kind: Kind;
		/**
		 * The kind's name in the reader's language ("Note", "Warning"). It is the aside's
		 * accessible name and its visible heading when no `title` is given.
		 */
		label: string;
		/** A specific heading that replaces the label on screen; the accessible name keeps both. */
		title?: string;
		children: RemixNode;
	}
}

/** The semantic tone and glyph each kind draws with. */
const CALLOUT_KINDS: Record<Callout.Kind, { tone: SemanticColor; Glyph: typeof InfoIcon }> = {
	note: { tone: "brand", Glyph: InfoIcon },
	tip: { tone: "success", Glyph: LightbulbIcon },
	warning: { tone: "warning", Glyph: TriangleAlertIcon },
	danger: { tone: "danger", Glyph: OctagonAlertIcon },
};

/**
 * Mixes a share of a tone's text colour into transparency, so the tint and the border
 * follow the theme's light and dark values of that tone.
 *
 * @param tone Semantic tone to mix from.
 * @param weight Percentage of the tone in the mix.
 */
function toneMix(tone: SemanticColor, weight: number) {
	return colorMix("oklab", { color: `var(--ui-${tone}-fg)`, weight }, "transparent");
}

/**
 * Renders the aside: a 6% tint with a 30% border of the kind's colour, a small radius,
 * and a heading line led by the glyph in the kind's colour. Text keeps the page's ink in
 * both themes, so a long callout reads like the prose around it.
 *
 * @param handle Runtime handle carrying the host `<aside>`'s props.
 * @returns The render function producing the callout's markup.
 * @example
 * <Callout kind="warning" label={t("callout.warning")}>Rotate the key before you deploy.</Callout>
 * @example
 * <Callout kind="tip" label={t("callout.tip")} title="Faster local runs">Pass `--watch`.</Callout>
 */
export function Callout(handle: Handle<Callout.Props>) {
	return () => {
		let { children, kind, label, mix, title, ...rest } = handle.props;
		let { tone, Glyph } = CALLOUT_KINDS[kind] ?? CALLOUT_KINDS.note;

		return (
			<aside
				aria-label={title ? `${label}: ${title}` : label}
				{...rest}
				data-slot="callout"
				data-kind={kind}
				mix={mergeMix(
					[
						vstack({ gap: 2, align: "stretch" }),
						minIs(0),
						p(3, 4),
						rounded("md"),
						border({ color: toneMix(tone, 30), width: 1, style: "solid" }),
						bg(toneMix(tone, 6)),
						text("sm"),
						leading("relaxed"),
						overflowWrap("anywhere"),
						when("& > :where(:not([data-slot='callout-title']))", m(0)),
					],
					mix,
				)}
			>
				<p
					data-slot="callout-title"
					mix={[
						m(0),
						hstack({ gap: 2, align: "center" }),
						weight("semibold"),
						fg("neutral.emphasis"),
					]}
				>
					<span data-slot="callout-icon" mix={[inlineFlex(), fg(tone)]}>
						<Glyph size={16} aria-hidden="true" />
					</span>
					{title ?? label}
				</p>
				{children}
			</aside>
		);
	};
}
