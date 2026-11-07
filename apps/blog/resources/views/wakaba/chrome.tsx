/**
 * The parts of Wakaba's shell that render the same in a browser test as on the server: the
 * wordmark, the quiet links and the header, which reads its labels from the page's copy and
 * links the page in the other language when it has one.
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

export namespace WakabaHeader {
	/** Props of the header. */
	export interface Props {
		/** The same page in the other language, on a page written in both. */
		switchTo?: NavLink & { locale: string };
	}
}

/**
 * The header: the wordmark home, then Support and Privacy, and on a bilingual page the
 * other language, named in that language. The short links fit beside the wordmark at 320px,
 * so the header needs no menu.
 *
 * @param handle Runtime handle carrying the link to the other language.
 * @returns The render function producing the header.
 */
export function WakabaHeader(handle: Handle<WakabaHeader.Props>) {
	return () => {
		let copy = copyOf(handle);
		let { switchTo } = handle.props;
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
					<span
						mix={[
							hstack({ gap: 4, align: "center" }),
							text("sm"),
							at("md", raw({ gap: "1.25rem" })),
						]}
					>
						<QuietLink href={routes.wakabaSupport.index.href()} label={copy.header.support} />
						<span
							mix={[raw({ display: "contents", "@media (max-width: 22rem)": { display: "none" } })]}
						>
							<QuietLink href={routes.wakabaPrivacy.href()} label={copy.header.privacy} />
						</span>
						{switchTo ? (
							<a
								href={switchTo.href}
								hreflang={switchTo.locale}
								lang={switchTo.locale}
								aria-label={switchTo.label}
								mix={[
									fg("brand"),
									weight("semibold"),
									raw({ textDecoration: "none" }),
									hover(fg("brand.emphasis")),
									focusVisible(raw({ outline: "2px solid currentColor", outlineOffset: "4px" })),
								]}
							>
								<span mix={[raw({ "@media (max-width: 30rem)": { display: "none" } })]}>
									{switchTo.label}
								</span>
								<span
									aria-hidden="true"
									mix={[
										raw({ display: "none", "@media (max-width: 30rem)": { display: "inline" } }),
									]}
								>
									{switchTo.locale.slice(0, 2).toUpperCase()}
								</span>
							</a>
						) : null}
					</span>
				</nav>
			</header>
		);
	};
}
