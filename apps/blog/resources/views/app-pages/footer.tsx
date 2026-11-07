/**
 * The footer and the quiet links of an app's pages on this domain: the app's wordmark and
 * promise beside columns of links, then who made it. Every app page shares the shape and
 * brings its own words, wordmark and palette.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { borderEdge, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { container, gap, grid, gridTemplate, repeat, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { m, maxIs, mi, p, pbe, pbs, pi } from "@sdxc/u/size";
import { focusVisible, hover } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";

import routes from "~/routes/web";

/** One link in the header or the footer. */
export interface NavLink {
	href: string;
	label: string;
	/** The language of the destination, when it differs from the page's. */
	hrefLang?: string;
}

/** One titled column of footer links. */
export interface FooterColumn {
	title: string;
	links: Array<NavLink>;
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
			hrefLang={handle.props.hrefLang}
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

/** Props of the footer. */
export interface AppFooterProps {
	/** The app's wordmark, linking to its landing. */
	brand: RemixNode;
	/** The app's promise under the wordmark. */
	tagline: string;
	columns: Array<FooterColumn>;
	/** The words before the author's name, "Made by" in the page's language. */
	madeBy: string;
	/** Anything after the columns, such as a language switcher. */
	extra?: RemixNode;
}

/**
 * The footer: the wordmark with the app's promise beside its columns of links, then who made
 * it. The columns sit in a row of their own from the `md` width of the footer.
 *
 * @param handle Runtime handle carrying the wordmark, the words and the links.
 * @returns The render function producing the footer.
 */
export function AppFooter(handle: Handle<AppFooterProps>) {
	return () => {
		let { brand, columns, extra, madeBy, tagline } = handle.props;
		return (
			<footer mix={[container("app-footer"), pi(4), pbs(12), pbe(10), at("md", pi(6))]}>
				<div
					mix={[
						vstack({ gap: 8, align: "stretch" }),
						maxIs("72rem"),
						mi("auto"),
						pbs(8),
						borderEdge("block-start", { width: 1, color: "neutral" }),
					]}
				>
					<div
						mix={[
							grid(),
							gap(8),
							at("lg", "app-footer", gridTemplate({ columns: "minmax(0, 1fr) auto" })),
						]}
					>
						<div mix={[vstack({ gap: 2, align: "start" })]}>
							{brand}
							<p mix={[m(0), text("sm"), fg("neutral"), maxIs("20rem")]}>{tagline}</p>
						</div>
						<div
							mix={[
								grid(),
								gap(8),
								gridTemplate({ columns: repeat(2, "minmax(0, 1fr)") }),
								at("md", "app-footer", gridTemplate({ columns: repeat(3, "max-content") })),
								at("md", "app-footer", raw({ columnGap: "4rem" })),
							]}
						>
							{columns.map((column) => (
								<nav
									key={column.title}
									aria-label={column.title}
									mix={[vstack({ gap: 3, align: "start" })]}
								>
									<h2 mix={[m(0), text("sm"), weight("semibold"), fg("neutral.emphasis")]}>
										{column.title}
									</h2>
									<ul
										mix={[
											vstack({ gap: 2, align: "start" }),
											m(0),
											p(0),
											raw({ listStyle: "none" }),
											text("sm"),
										]}
									>
										{column.links.map((link) => (
											<li key={link.href}>
												<QuietLink {...link} />
											</li>
										))}
									</ul>
								</nav>
							))}
						</div>
					</div>
					{extra}
					<p mix={[m(0), text("sm"), fg("neutral.muted")]}>
						{madeBy}{" "}
						<a
							href={routes.feed.href()}
							mix={[
								fg("neutral"),
								hover(fg("neutral.emphasis")),
								focusVisible(raw({ outline: "2px solid currentColor", outlineOffset: "2px" })),
							]}
						>
							Sergio Xalambrí
						</a>{" "}
						· © 2026
					</p>
				</div>
			</footer>
		);
	};
}
