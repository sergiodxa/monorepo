/**
 * Layout component for public blog pages. Renders the HTML document shell with
 * title, description, canonical, and custom meta tags, injects the design
 * system's reset and theme stylesheets plus any per-page ones, and draws the
 * parchment body and main navigation bar before the page children. Exists to
 * give every public page a shared shell.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { NavLink } from "@pkg/r3-ui";
import resetStyles from "@pkg/r3-ui/reset.css?url";
import themeStyles from "@pkg/r3-ui/theme.css?url";
import { bg, border, fg, radialGradient } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { flexWrap, hstack } from "@pkg/u/layout";
import { m, maxIs, mbe, mbs, mi, minBs, pb, pbe, pbs, pi } from "@pkg/u/size";
import { color } from "@pkg/u/tokens";
import { font, text, textTransform, tracking } from "@pkg/u/typography";

import appColorsStyles from "~/resources/css/colors.css?url";
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
		stylesheets?: Array<{ href: string; media?: string }>;
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
		let {
			activePath,
			canonical,
			children,
			description,
			meta = [],
			stylesheets = [],
			title,
		} = handle.props;

		return (
			<html lang="en">
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<title>{title}</title>
					<meta name="description" content={description} />
					{canonical ? <link rel="canonical" href={canonical} /> : null}
					{meta.map((tag) => (
						<meta
							key={tag.property ?? tag.name ?? tag.content}
							property={tag.property}
							name={tag.name}
							content={tag.content}
						/>
					))}
					{/* Reset first, then this app's raw palette scales, then the semantic
					theme layer that reads them. Custom properties resolve at used-value
					time so the order between the last two can't change which value wins,
					but reading least-specific to most mirrors how the tokens layer. */}
					<link rel="stylesheet" href={resetStyles} />
					<link rel="stylesheet" href={appColorsStyles} />
					<link rel="stylesheet" href={themeStyles} />
					{stylesheets.map((item) => (
						<link
							key={item.href + (item.media ?? "")}
							rel="stylesheet"
							href={item.href}
							media={item.media}
						/>
					))}
				</head>
				<body
					mix={[
						m(0),
						minBs("100vh"),
						font("serif"),
						fg("neutral.emphasis"),
						/* The parchment wash: a fixed, oversized radial gradient running from
						the two lightest neutral tints out to the 200 step, so the page reads
						as a sheet of aged paper lit from its top-left corner rather than a
						flat fill. Fixed attachment keeps the light source still while the
						content scrolls past it. */
						bg({
							color: "neutral.tint",
							image: radialGradient(
								"circle at 10% 10%",
								{ color: color("neutral.bg-tint-hover"), position: "0" },
								{ color: color("neutral.bg-tint-hover"), position: "18%" },
								{ color: color("neutral.bg-tint-pressed"), position: "52%" },
								{ color: color("color.neutral.200"), position: "100%" },
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
				</body>
			</html>
		);
	};
}
