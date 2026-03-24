import type { RemixNode } from "remix/component";

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
	{ href: "/cms", label: "Dashboard" },
	{ href: "/cms/articles", label: "Articles" },
	{ href: "/cms/tutorials", label: "Tutorials" },
	{ href: "/cms/bookmarks", label: "Bookmarks" },
	{ href: "/cms/glossary", label: "Glossary" },
	{ href: "/cms/redirects", label: "Redirects" },
	{ href: "/logout", label: "Logout" },
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
				css={{
					margin: 0,
					fontFamily: "'IBM Plex Sans', 'Avenir Next', 'Segoe UI', sans-serif",
					backgroundColor: "var(--ui-neutral-bg-tint)",
					color: "var(--ui-neutral-fg-emphasis)",
				}}
			>
				<div css={{ maxWidth: "64rem", margin: "0 auto", padding: "1.4rem 1rem 2.5rem" }}>
					<header css={{ marginBottom: "1.1rem", display: "grid", gap: "0.6rem" }}>
						<h1 css={{ margin: 0, fontSize: "1.35rem" }}>Dashboard</h1>
						<nav aria-label="Dashboard" css={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
							{cmsNavigationItems.map((item) => (
								<a
									key={item.href}
									href={item.href}
									css={{
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
									}}
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
