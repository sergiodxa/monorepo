/**
 * One tile in the `@sdxc/ui` component explorer: a visual plane above the name and a short
 * line of what the pattern is, so a reader scans faces the way they would scan a gallery
 * rather than a dense sheet of links.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { listStyle, raw } from "@sdxc/u/general";
import { center, relative, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { bs, m, minBs, minIs, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, leading, lineClamp, overflowWrap, text, tracking, weight } from "@sdxc/u/typography";

namespace UiComponentCard {
	export interface Props {
		href: string;
		name: string;
		description?: string;
	}
}

/** Renders one linked explorer tile. */
export default function UiComponentCard(handle: Handle<UiComponentCard.Props>) {
	return () => {
		let { description, href, name } = handle.props;

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
							center(),
							minBs("8rem"),
							p(5),
							overflow("hidden"),
							bg("neutral.tint"),
							border({ color: "neutral.border", width: 0, style: "solid" }),
							raw({
								borderBlockEndWidth: "1px",
								backgroundImage:
									"radial-gradient(80% 120% at 100% 0%, color-mix(in oklch, var(--ui-brand-bg-solid) 12%, transparent), transparent 70%)",
							}),
						]}
					>
						<span
							mix={[
								font("mono"),
								text("3xl"),
								weight("medium"),
								tracking("tight"),
								fg("neutral.emphasis"),
								raw({ opacity: 0.18 }),
								overflowWrap("anywhere"),
								lineClamp(2),
							]}
						>
							{name}
						</span>
					</div>

					<div mix={[vstack({ gap: 1, align: "stretch" }), p(4), minIs(0)]}>
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
