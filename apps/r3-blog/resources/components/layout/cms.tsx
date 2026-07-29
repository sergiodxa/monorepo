/**
 * Layout component for the CMS/admin section. Renders the HTML document shell
 * with head metadata, the design system's reset and theme stylesheets, and a top
 * navigation bar linking the dashboard, content sections, and logout, then wraps
 * each page's children. Exists to give all authenticated CMS screens a
 * consistent chrome.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { Heading, NavLink } from "@pkg/r3-ui";
import resetStyles from "@pkg/r3-ui/reset.css?url";
import themeStyles from "@pkg/r3-ui/theme.css?url";
import { bg, border, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { flexWrap, gap, grid, hstack } from "@pkg/u/layout";
import { m, maxIs, mbe, mi, pb, pbe, pbs, pi } from "@pkg/u/size";
import { font, text } from "@pkg/u/typography";

import appColorsStyles from "~/resources/css/colors.css?url";
import routes from "~/routes/web";

/**
 * Shared types used by the CMS page layout.
 */
export namespace CMSLayout {
	/**
	 * Inputs for rendering a CMS page shell.
	 */
	export type Props = {
		title: string;
		activePath?: string;
		children: RemixNode;
	};

	/**
	 * One item displayed in the CMS top navigation.
	 */
	export type NavigationItem = {
		href: string;
		label: string;
	};
}

/**
 * Ordered links shown in the CMS navigation bar.
 */
let cmsNavigationItems: Array<CMSLayout.NavigationItem> = [
	{ href: routes.cms.dashboard.href(), label: "Dashboard" },
	{ href: routes.cms.articles.index.href(), label: "Articles" },
	{ href: routes.cms.tutorials.index.href(), label: "Tutorials" },
	{ href: routes.cms.bookmarks.index.href(), label: "Bookmarks" },
	{ href: routes.cms.glossary.index.href(), label: "Glossary" },
	{ href: routes.cms.redirects.index.href(), label: "Redirects" },
	{ href: routes.auth.logout.index.href(), label: "Logout" },
];

/**
 * Builds the CMS document layout with shared navigation and styles.
 *
 * @returns A renderer that wraps page content in the CMS shell.
 */
export function CMSLayout(handle: Handle<CMSLayout.Props>) {
	return () => {
		let { activePath, children, title } = handle.props;

		return (
			<html lang="en">
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<title>{title}</title>
					{/* Reset first, then this app's raw palette scales, then the semantic
					theme layer that reads them — the same order every public page uses. */}
					<link rel="stylesheet" href={resetStyles} />
					<link rel="stylesheet" href={appColorsStyles} />
					<link rel="stylesheet" href={themeStyles} />
				</head>
				{/* The CMS drops the public pages' serif and parchment wash for the sans
				face on a flat tint: these screens are dense tables and forms, where a
				reading typeface and a gradient both work against scanning. */}
				<body mix={[m(0), font("sans"), bg("neutral.tint"), fg("neutral.emphasis")]}>
					<div mix={[maxIs("64rem"), mi("auto"), pbs(6), pi(4), pbe(10)]}>
						<header mix={[grid(), gap(3), mbe(4)]}>
							<Heading level={1} mix={[text("2xl")]}>
								Dashboard
							</Heading>
							<nav aria-label="Dashboard" mix={[hstack({ gap: 2 }), flexWrap("wrap")]}>
								{cmsNavigationItems.map((item) => {
									let isActive = activePath === item.href;

									return (
										<NavLink
											key={item.href}
											href={item.href}
											color="brand"
											hasBackground
											aria-current={isActive ? "page" : undefined}
											mix={[
												text("sm"),
												pi(3),
												pb(1),
												rounded("lg"),
												border({ width: 1, color: "neutral" }),
												bg(isActive ? "brand.tint" : "neutral.tint"),
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
