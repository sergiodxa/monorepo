/**
 * Layout component for the CMS/admin section. Composes the shared document shell
 * and adds a top navigation bar linking the dashboard, content sections, and
 * logout, then wraps each page's children. Exists to give all authenticated CMS
 * screens a consistent chrome.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { flexWrap, gap, grid, hstack } from "@sdxc/u/layout";
import { m, maxIs, mbe, mi, pb, pbe, pbs, pi } from "@sdxc/u/size";
import { font, text } from "@sdxc/u/typography";
import { Heading, NavLink } from "@sdxc/ui";

import DocumentLayout from "~/resources/layouts/document";
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
 * The screens sit behind auth, so the shell carries only a title, and dresses
 * them in a sans face over a flat tint — the pairing that keeps dense tables and
 * forms scannable.
 *
 * @returns A renderer that wraps page content in the CMS shell.
 */
export function CMSLayout(handle: Handle<CMSLayout.Props>) {
	return () => {
		let { activePath, children, title } = handle.props;

		return (
			<DocumentLayout
				title={title}
				bodyMix={[m(0), font("sans"), bg("neutral.tint"), fg("neutral.emphasis")]}
			>
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
			</DocumentLayout>
		);
	};
}
