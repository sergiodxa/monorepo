/**
 * One tile in the `@sdxc/ui` export catalogues: a live miniature of the mixin,
 * behavior, animation or style above its name, matching the component explorer
 * cards so the landing reads as one gallery.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { listStyle } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { bs, m, minIs, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, overflowWrap, text, weight } from "@sdxc/u/typography";

import type { UiSubpath } from "~/app/services/ui-subpaths";

import UiExportMiniature from "~/resources/components/ui-export-faces";

namespace UiExportCard {
	export interface Props {
		href: string;
		name: string;
		subpath: UiSubpath;
	}
}

/** Renders one linked export tile with its subpath miniature. */
export default function UiExportCard(handle: Handle<UiExportCard.Props>) {
	return () => {
		let { href, name, subpath } = handle.props;

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
					<UiExportMiniature subpath={subpath} name={name} />

					<div mix={[vstack({ gap: 1, align: "stretch" }), p(3), minIs(0), bg()]}>
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
					</div>
				</a>
			</li>
		);
	};
}
