/**
 * The parts of Wakaba's shell that render the same in a browser test as on the server: the
 * wordmark, the quiet links and the header, which reads its labels from the page's copy and
 * labels follow the page's language.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { maxIs, mi, pb, pi } from "@sdxc/u/size";
import { focusVisible, hover } from "@sdxc/u/state";
import { font, text, weight } from "@sdxc/u/typography";

import { copyOf, WakabaMark } from "~/resources/views/wakaba/parts";
import routes from "~/routes/web";

/** One link in the header or the footer. */
export interface NavLink {
	href: string;
	label: string;
}

/**
 * The wordmark linking home: the 学 mark in the accent beside "Wakaba" set in the rounded
 * display face, the way the app names itself on the home screen.
 *
 * @returns The render function producing the link.
 */
export function Wordmark() {
	return () => (
		<a
			href={routes.wakaba.href()}
			mix={[
				hstack({ gap: 2, align: "center" }),
				fg("neutral.emphasis"),
				raw({ textDecoration: "none" }),
				font("display"),
				text("xl"),
				weight("bold"),
				focusVisible(raw({ outline: "2px solid currentColor", outlineOffset: "4px" })),
			]}
		>
			<span mix={[fg("brand"), hstack({ gap: 0, align: "center" })]}>
				<WakabaMark size={30} />
			</span>
			Wakaba
		</a>
	);
}

/**
 * A plain text link in the header or footer, quiet until hovered.
 *
 * @param handle Runtime handle carrying the destination and label.
 * @returns The render function producing the link.
 */
export function QuietLink(handle: Handle<NavLink>) {
	return () => (
		<a
			href={handle.props.href}
			mix={[
				fg("neutral"),
				weight("medium"),
				raw({ textDecoration: "none" }),
				hover(fg("neutral.emphasis")),
				focusVisible(raw({ outline: "2px solid currentColor", outlineOffset: "4px" })),
			]}
		>
			{handle.props.label}
		</a>
	);
}

/**
 * The header: the wordmark home, then Support and Privacy. The two short links fit beside
 * the wordmark at 320px in either language, so the header needs no menu.
 *
 * @returns The render function producing the header.
 */
export function WakabaHeader(handle: Handle) {
	return () => {
		let copy = copyOf(handle);
		return (
			<header mix={[pi(4), at("md", pi(6))]}>
				<nav
					aria-label={copy.header.navLabel}
					mix={[
						hstack({ gap: 4, align: "center", justify: "between" }),
						maxIs("72rem"),
						mi("auto"),
						pb(4),
					]}
				>
					<Wordmark />
					<span mix={[hstack({ gap: 5, align: "center" }), text("sm")]}>
						<QuietLink href={routes.wakabaSupport.index.href()} label={copy.header.support} />
						<QuietLink href={routes.wakabaPrivacy.href()} label={copy.header.privacy} />
					</span>
				</nav>
			</header>
		);
	};
}
