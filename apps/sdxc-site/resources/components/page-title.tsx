/**
 * The heading a documentation page opens with, set the way the landing sets its bands: a
 * short mono label naming where the page sits, the title at display size, and a lead in a
 * lighter voice.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m, maxIs } from "@sdxc/u/size";
import {
	balance,
	font,
	leading,
	overflowWrap,
	text,
	textTransform,
	tracking,
	weight,
} from "@sdxc/u/typography";

namespace PageTitle {
	export interface Props {
		/** Where the page sits — its section, its package, its family — set above the title. */
		eyebrow?: string;
		title: RemixNode;
		/** Sets the title in the monospace face, for a title that is a name a reader types. */
		mono?: boolean;
		/** The lead under the title. */
		children?: RemixNode;
	}
}

/**
 * Renders the label, the title and the lead, each as wide as the column, so text with no
 * break point (a long package name, inline code in the lead) breaks inside it. A monospace
 * title starts a step smaller on a phone.
 */
export default function PageTitle(handle: Handle<PageTitle.Props>) {
	return () => {
		let { children, eyebrow, mono = false, title } = handle.props;

		return (
			<div mix={[vstack({ gap: 4, align: "stretch" }), maxIs("48rem"), overflowWrap("break-word")]}>
				{eyebrow ? (
					<p
						mix={[
							m(0),
							font("mono"),
							text("xs"),
							textTransform("uppercase"),
							tracking("widest"),
							fg("brand"),
						]}
					>
						[ {eyebrow} ]
					</p>
				) : null}

				<h1
					mix={[
						m(0),
						fg("neutral.emphasis"),
						mono ? [font("mono"), tracking("tight")] : tracking("-0.04em"),
						weight("medium"),
						leading(1.05),
						balance(),
						text(mono ? "3xl" : "4xl"),
						media("(min-width: 48rem)", text("5xl")),
					]}
				>
					{title}
				</h1>

				{children ? (
					<p mix={[m(0), text("xl"), leading("relaxed"), fg("neutral")]}>{children}</p>
				) : null}
			</div>
		);
	};
}
