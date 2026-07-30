/**
 * Layout component for public blog pages. Composes the shared document shell,
 * forwarding the page's title, description, canonical and social tags, and draws
 * the silvered body and main navigation bar before the page children. Exists to
 * give every public page a shared shell.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { NavLink } from "@pkg/r3-ui";
import { bg, border, fg, radialGradient } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { flexWrap, hstack } from "@pkg/u/layout";
import { m, maxIs, mbe, mbs, mi, minBs, pb, pbe, pbs, pi } from "@pkg/u/size";
import { color } from "@pkg/u/tokens";
import { font, text, textTransform, tracking } from "@pkg/u/typography";

import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/**
 * Groups the layout props and related metadata types.
 */
export namespace BlogLayout {
	/**
	 * Describes a meta tag rendered in the document head.
	 */
	export interface MetaTag {
		property?: string;
		name?: string;
		content: string;
	}

	/**
	 * Supplies document metadata and content needed to render the public blog shell.
	 */
	export interface Props {
		title: string;
		description: string;
		activePath?: string;
		canonical?: string;
		meta?: Array<MetaTag>;
		children: RemixNode;
	}

	/**
	 * Represents a single link in the main navigation.
	 */
	export interface NavigationItem {
		href: string;
		label: string;
	}
}

/**
 * Lists the primary navigation links shown in the blog header.
 */
let navigationItems: Array<BlogLayout.NavigationItem> = [
	{ href: routes.feed.href(), label: "Home" },
	{ href: routes.articles.href(), label: "Articles" },
	{ href: routes.tutorials.href(), label: "Tutorials" },
	{ href: routes.bookmarks.href(), label: "Bookmarks" },
	{ href: routes.glossary.href(), label: "Glossary" },
	{ href: routes.cms.dashboard.href(), label: "Dashboard" },
];

/**
 * Creates the shared HTML layout used by public blog pages.
 *
 * @returns A renderer that wraps page content with head metadata and navigation.
 */
export function BlogLayout(handle: Handle<BlogLayout.Props>) {
	return () => {
		let { activePath, canonical, children, description, meta = [], title } = handle.props;

		return (
			<DocumentLayout
				title={title}
				description={description}
				canonical={canonical}
				meta={meta}
				bodyMix={[
					m(0),
					minBs("100vh"),
					font("serif"),
					fg("neutral.emphasis"),
					/* The silver sheen: a fixed, oversized radial gradient running from the
					lightest neutral tint out to the next step, so the page reads as a
					sheet of brushed metal catching light at its top-left corner rather
					than a flat fill. Fixed attachment keeps the light source still while
					the content scrolls past it, and the base color matches the outer stop
					so a viewport wider than the gradient shows no seam.

					The wash deliberately spans only those two steps. Link text is brand's
					600 step, which clears AA against both of them (4.91:1 and 4.63:1) and
					stops clearing it against anything darker, so letting the sheen deepen
					further would trade readable links for a more dramatic gradient. */
					bg({
						color: "neutral.bg-tint-hover",
						image: radialGradient(
							"circle at 10% 10%",
							{ color: color("neutral.tint"), position: "0" },
							{ color: color("neutral.tint"), position: "20%" },
							{ color: color("neutral.bg-tint-hover"), position: "100%" },
						),
						repeat: "no-repeat",
						size: "150vmax 150vmax",
						attachment: "fixed",
					}),
				]}
			>
				<div mix={[maxIs("85ch"), mi("auto"), pbs(8), pi(4), pbe(12)]}>
					<header mix={[mbe(8)]}>
						<p
							mix={[
								m(0),
								text("xs"),
								textTransform("uppercase"),
								tracking("widest"),
								fg("neutral.muted"),
							]}
						>
							Sergio Xalambrí
						</p>
						<nav aria-label="Main" mix={[hstack({ gap: 2 }), flexWrap("wrap"), mbs(3)]}>
							{navigationItems.map((item) => {
								let isActive = activePath === item.href;

								return (
									<NavLink
										key={item.href}
										href={item.href}
										color={isActive ? "brand" : "neutral"}
										hasBackground
										aria-current={isActive ? "page" : undefined}
										mix={[
											text("sm"),
											pi(3),
											pb(1),
											rounded("full"),
											border({ width: 1, color: isActive ? "brand" : "neutral" }),
											bg(isActive ? "brand.tint" : "neutral.bg-tint-hover"),
										]}
									>
										{item.label}
									</NavLink>
								);
							})}
						</nav>
					</header>
					{children}
				</div>
			</DocumentLayout>
		);
	};
}
