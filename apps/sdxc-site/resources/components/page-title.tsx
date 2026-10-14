/**
 * The heading a documentation page opens with, set the way the landing sets its bands: a
 * short mono label naming where the page sits, the title at display size, and a lead in a
 * lighter voice. Every page in the documentation opens on it, so a reader crossing from the
 * landing into a guide or a package reads one design.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m, maxIs } from "@sdxc/u/size";
import { balance, font, leading, text, textTransform, tracking, weight } from "@sdxc/u/typography";

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

/** Renders the label, the title and the lead. */
export default function PageTitle(handle: Handle<PageTitle.Props>) {
	return () => {
		let { children, eyebrow, mono = false, title } = handle.props;

		return (
			<div mix={[vstack({ gap: 4, align: "start" }), maxIs("48rem")]}>
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
						text("4xl"),
						media("(min-width: 48rem)", text("5xl")),
					]}
				>
					{title}
				</h1>

				{children ? (
					<p mix={[m(0), text("lg"), leading("relaxed"), fg("neutral")]}>{children}</p>
				) : null}
			</div>
		);
	};
}
