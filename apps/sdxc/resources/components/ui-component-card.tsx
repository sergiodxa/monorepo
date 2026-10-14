/**
 * One tile in the `@sdxc/ui` component explorer: a frosted-glass silhouette of the pattern
 * above its name and a short line of what it is, so a reader scans faces the way they would
 * scan a gallery rather than a dense sheet of links.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { listStyle, raw } from "@sdxc/u/general";
import { relative, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { bs, m, minBs, minIs, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, leading, lineClamp, overflowWrap, text, weight } from "@sdxc/u/typography";

import UiComponentGlyph from "~/resources/components/ui-component-glyph";

/** Fixed block size of the preview plane, so every tile shares one rhythm. */
const PREVIEW_HEIGHT = "9.5rem";

/**
 * Soft wash behind the glyph. Reads as a gallery plane rather than a blank cell, and stays
 * on the page's own tokens so theming still lands.
 */
const PREVIEW_WASH = {
	backgroundImage: [
		"radial-gradient(120% 90% at 0% 0%, color-mix(in oklch, var(--ui-brand-bg-solid) 16%, transparent), transparent 55%)",
		"radial-gradient(90% 80% at 100% 100%, color-mix(in oklch, var(--ui-neutral-border) 45%, transparent), transparent 60%)",
		"linear-gradient(160deg, color-mix(in oklch, var(--ui-brand-bg-tint) 70%, var(--ui-neutral-bg-tint)), var(--ui-neutral-bg-tint))",
	].join(", "),
};

namespace UiComponentCard {
	export interface Props {
		href: string;
		name: string;
		slug: string;
		description?: string;
	}
}

/** Renders one linked explorer tile with a frosted preview of the pattern. */
export default function UiComponentCard(handle: Handle<UiComponentCard.Props>) {
	return () => {
		let { description, href, name, slug } = handle.props;

		return (
			<li mix={[minIs(0), listStyle("none"), m(0)]}>
				<a
					href={href}
					mix={[
						vstack({ gap: 0, align: "stretch" }),
						minIs(0),
						bs("100%"),
						overflow("hidden"),
						rounded("xl"),
						border({ color: "neutral.border", width: 1, style: "solid" }),
						bg(),
						transition("border-color, background-color, box-shadow"),
						when("&:hover", [
							bg("neutral.tint"),
							border({ color: "neutral.border-strong", width: 1, style: "solid" }),
						]),
						when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					]}
				>
					<div
						aria-hidden="true"
						mix={[
							relative(),
							minBs(PREVIEW_HEIGHT),
							bs(PREVIEW_HEIGHT),
							overflow("hidden"),
							bg("neutral.tint"),
							border({ color: "neutral.border", width: 0, style: "solid" }),
							raw({
								borderBlockEndWidth: "1px",
								...PREVIEW_WASH,
							}),
						]}
					>
						<UiComponentGlyph slug={slug} />
					</div>

					<div mix={[vstack({ gap: 1, align: "stretch" }), p(4), minIs(0), bg()]}>
						<code
							mix={[
								font("mono"),
								text("sm"),
								weight("semibold"),
								fg("neutral.emphasis"),
								overflowWrap("anywhere"),
							]}
						>
							{name}
						</code>
						{description ? (
							<span mix={[text("sm"), leading("relaxed"), fg("neutral"), lineClamp(2)]}>
								{description}
							</span>
						) : null}
					</div>
				</a>
			</li>
		);
	};
}
