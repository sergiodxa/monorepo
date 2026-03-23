import type { RemixNode } from "remix/component";

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
						"radial-gradient(circle at 10% 10%, #f5f1e8 0, #f5f1e8 12%, #efe7d9 45%, #ece3d5 100%)",
					color: "#1a1917",
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
								color: "#6a6255",
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
										border: "1px solid #d3c8b5",
										color: activePath === item.href ? "#1f4f62" : "#5f5648",
										backgroundColor: activePath === item.href ? "#dcecf2" : "#f8f3e7",
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
