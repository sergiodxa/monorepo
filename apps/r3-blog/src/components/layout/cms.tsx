import type { RemixNode } from "remix/component";

import { css } from "remix/component";

import routes from "~/routes";
import appColorsStyles from "~/styles/colors.css?url";

export namespace CMSLayout {
	export type Props = {
		title: string;
		activePath?: string;
		children: RemixNode;
	};

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

export function CMSLayout() {
	return ({ activePath, children, title }: CMSLayout.Props) => (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>{title}</title>
				<link rel="stylesheet" href={appColorsStyles} />
			</head>
			<body
				mix={[
					css({
						margin: 0,
						fontFamily: "'IBM Plex Sans', 'Avenir Next', 'Segoe UI', sans-serif",
						backgroundColor: "var(--ui-neutral-bg-tint)",
						color: "var(--ui-neutral-fg-emphasis)",
					}),
				]}
			>
				<div mix={[css({ maxWidth: "64rem", margin: "0 auto", padding: "1.4rem 1rem 2.5rem" })]}>
					<header mix={[css({ marginBottom: "1.1rem", display: "grid", gap: "0.6rem" })]}>
						<h1 mix={[css({ margin: 0, fontSize: "1.35rem" })]}>Dashboard</h1>
						<nav
							aria-label="Dashboard"
							mix={[css({ display: "flex", flexWrap: "wrap", gap: "0.45rem" })]}
						>
							{cmsNavigationItems.map((item) => (
								<a
									key={item.href}
									href={item.href}
									mix={[
										css({
											padding: "0.35rem 0.65rem",
											borderRadius: "0.5rem",
											fontSize: "0.88rem",
											textDecoration: "none",
											border: "1px solid var(--ui-neutral-border)",
											color:
												activePath === item.href
													? "var(--ui-accent-fg-emphasis)"
													: "var(--ui-accent-fg)",
											backgroundColor:
												activePath === item.href
													? "var(--ui-accent-bg-tint)"
													: "var(--ui-neutral-bg-tint)",
										}),
									]}
								>
									{item.label}
								</a>
							))}
						</nav>
					</header>
					{children}
				</div>
			</body>
		</html>
	);
}
