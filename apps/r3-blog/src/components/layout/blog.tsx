import type { RemixNode } from "remix/component";

import { css } from "remix/component";

import routes from "~/routes";
import appColorsStyles from "~/styles/colors.css?url";

export namespace BlogLayout {
	export interface MetaTag {
		property?: string;
		name?: string;
		content: string;
	}

	export interface Props {
		title: string;
		description: string;
		activePath?: string;
		stylesheets?: Array<{ href: string; media?: string }>;
		canonical?: string;
		meta?: Array<MetaTag>;
		children: RemixNode;
	}

	export interface NavigationItem {
		href: string;
		label: string;
	}
}

let navigationItems: Array<BlogLayout.NavigationItem> = [
	{ href: routes.feed.href(), label: "Home" },
	{ href: routes.articles.href(), label: "Articles" },
	{ href: routes.tutorials.href(), label: "Tutorials" },
	{ href: routes.bookmarks.href(), label: "Bookmarks" },
	{ href: routes.glossary.href(), label: "Glossary" },
	{ href: routes.cms.dashboard.href(), label: "Dashboard" },
];

export function BlogLayout() {
	return ({
		activePath,
		canonical,
		children,
		description,
		meta = [],
		stylesheets = [],
		title,
	}: BlogLayout.Props) => (
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
				<link rel="stylesheet" href={appColorsStyles} />
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
					css({
						margin: 0,
						fontFamily: "'Source Serif 4', 'Iowan Old Style', 'Palatino Linotype', serif",
						backgroundColor: "var(--color-neutral-200)",
						backgroundImage:
							"radial-gradient(circle at 10% 10%, var(--ui-neutral-bg-tint-hover) 0, var(--ui-neutral-bg-tint-hover) 18%, var(--ui-neutral-bg-tint-pressed) 52%, var(--color-neutral-200) 100%)",
						backgroundRepeat: "no-repeat",
						backgroundSize: "150vmax 150vmax",
						backgroundAttachment: "fixed",
						color: "var(--ui-neutral-fg-emphasis)",
						minHeight: "100vh",
					}),
				]}
			>
				<div
					mix={[
						css({
							maxWidth: "85ch",
							margin: "0 auto",
							padding: "2rem 1rem 3rem",
						}),
					]}
				>
					<header mix={[css({ marginBottom: "2rem" })]}>
						<p
							mix={[
								css({
									textTransform: "uppercase",
									letterSpacing: "0.16em",
									fontSize: "0.75rem",
									margin: 0,
									color:
										"color-mix(in oklch, var(--ui-neutral-fg-muted) 88%, var(--ui-neutral-bg-tint))",
									textShadow:
										"0 -1px 0 color-mix(in oklch, var(--ui-neutral-fg-emphasis) 28%, transparent), 0 1px 0 color-mix(in oklch, var(--ui-neutral-bg-tint) 92%, white), 0 2px 2px color-mix(in oklch, var(--ui-neutral-fg-muted) 12%, transparent)",
								}),
							]}
						>
							Sergio Xalambrí
						</p>
						<nav
							aria-label="Main"
							mix={[
								css({
									display: "flex",
									gap: "0.5rem",
									marginTop: "0.75rem",
									flexWrap: "wrap",
								}),
							]}
						>
							{navigationItems.map((item) => (
								<a
									key={item.href}
									href={item.href}
									mix={[
										css({
											padding: "0.3rem 0.7rem",
											borderRadius: "999px",
											fontSize: "0.9rem",
											textDecoration: "none",
											border: "1px solid var(--ui-neutral-border)",
											color:
												activePath === item.href ? "var(--ui-accent-fg)" : "var(--ui-neutral-fg)",
											backgroundColor:
												activePath === item.href
													? "var(--ui-accent-bg-tint)"
													: "var(--ui-neutral-bg-tint-hover)",
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
