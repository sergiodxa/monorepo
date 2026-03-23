import type { RemixNode } from "remix/component";

import appColorsStyles from "~/styles/colors.css?url";

interface BlogLayoutProps {
	title: string;
	description: string;
	activePath?: string;
	stylesheets?: Array<{ href: string; media?: string }>;
	children: RemixNode;
}

interface NavigationItem {
	href: string;
	label: string;
}

let navigationItems: Array<NavigationItem> = [
	{ href: "/", label: "Home" },
	{ href: "/articles", label: "Articles" },
	{ href: "/tutorials", label: "Tutorials" },
	{ href: "/bookmarks", label: "Bookmarks" },
	{ href: "/glossary", label: "Glossary" },
	{ href: "/cms", label: "Dashboard" },
];

export function BlogLayout() {
	return ({ activePath, children, description, stylesheets = [], title }: BlogLayoutProps) => (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>{title}</title>
				<meta name="description" content={description} />
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
				css={{
					margin: 0,
					fontFamily: "'Source Serif 4', 'Iowan Old Style', 'Palatino Linotype', serif",
					background:
						"radial-gradient(circle at 10% 10%, var(--ui-neutral-bg-tint-hover) 0, var(--ui-neutral-bg-tint-hover) 18%, var(--ui-neutral-bg-tint-pressed) 52%, var(--color-neutral-200) 100%)",
					color: "var(--ui-neutral-fg-emphasis)",
					minHeight: "100vh",
				}}
			>
				<div
					css={{
						maxWidth: "85ch",
						margin: "0 auto",
						padding: "2rem 1rem 3rem",
					}}
				>
					<header css={{ marginBottom: "2rem" }}>
						<p
							css={{
								textTransform: "uppercase",
								letterSpacing: "0.16em",
								fontSize: "0.75rem",
								margin: 0,
								color:
									"color-mix(in oklch, var(--ui-neutral-fg-muted) 88%, var(--ui-neutral-bg-tint))",
								textShadow:
									"0 -1px 0 color-mix(in oklch, var(--ui-neutral-fg-emphasis) 28%, transparent), 0 1px 0 color-mix(in oklch, var(--ui-neutral-bg-tint) 92%, white), 0 2px 2px color-mix(in oklch, var(--ui-neutral-fg-muted) 12%, transparent)",
							}}
						>
							Sergio Xalambrí
						</p>
						<nav
							aria-label="Main"
							css={{
								display: "flex",
								gap: "0.5rem",
								marginTop: "0.75rem",
								flexWrap: "wrap",
							}}
						>
							{navigationItems.map((item) => (
								<a
									key={item.href}
									href={item.href}
									css={{
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
