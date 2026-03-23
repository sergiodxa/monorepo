import type { RemixNode } from "remix/component";

interface CMSLayoutProps {
	title: string;
	activePath?: string;
	children: RemixNode;
}

interface CMSResourcePageProps {
	title: string;
	activePath: string;
	searchLabel: string;
	searchCta: string;
	primaryCta?: { href: string; label: string };
	items?: Array<{ label: string; href: string }>;
	emptyLabel?: string;
}

interface CMSActionPageProps {
	title: string;
	activePath: string;
	description: string;
}

interface CMSDashboardPageProps {
	stats: {
		articles: number;
		likes: number;
		tutorials: number;
		glossary: number;
	};
	recentSearches: Array<string>;
}

let cmsNavItems = [
	{ href: "/cms", label: "Dashboard" },
	{ href: "/cms/articles", label: "Articles" },
	{ href: "/cms/tutorials", label: "Tutorials" },
	{ href: "/cms/bookmarks", label: "Bookmarks" },
	{ href: "/cms/glossary", label: "Glossary" },
	{ href: "/cms/redirects", label: "Redirects" },
];

export function CMSLayout() {
	return ({ activePath, children, title }: CMSLayoutProps) => (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>{title}</title>
			</head>
			<body
				css={{
					margin: 0,
					fontFamily: "'IBM Plex Sans', 'Avenir Next', 'Segoe UI', sans-serif",
					backgroundColor: "#f6f7fb",
					color: "#131722",
				}}
			>
				<div css={{ maxWidth: "64rem", margin: "0 auto", padding: "1.4rem 1rem 2.5rem" }}>
					<header css={{ marginBottom: "1.1rem", display: "grid", gap: "0.6rem" }}>
						<h1 css={{ margin: 0, fontSize: "1.35rem" }}>Dashboard</h1>
						<nav aria-label="Dashboard" css={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
							{cmsNavItems.map((item) => (
								<a
									key={item.href}
									href={item.href}
									css={{
										padding: "0.35rem 0.65rem",
										borderRadius: "0.5rem",
										fontSize: "0.88rem",
										textDecoration: "none",
										border: "1px solid #d8dbe7",
										color: activePath === item.href ? "#0b4db9" : "#2f3b55",
										backgroundColor: activePath === item.href ? "#eaf0ff" : "#ffffff",
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

export function CMSDashboardPage() {
	return ({ recentSearches, stats }: CMSDashboardPageProps) => (
		<CMSLayout title="Dashboard" activePath="/cms">
			<main css={{ display: "grid", gap: "0.9rem" }}>
				<section
					css={{
						backgroundColor: "#fff",
						border: "1px solid #dfe3f1",
						borderRadius: "0.7rem",
						padding: "1rem",
					}}
				>
					<h2 css={{ margin: 0, fontSize: "1.1rem" }}>Post Stats</h2>
					<ul css={{ margin: "0.7rem 0 0", paddingLeft: "1rem", display: "grid", gap: "0.35rem" }}>
						<li>Total Articles: {stats.articles}</li>
						<li>Total Likes: {stats.likes}</li>
						<li>Total Tutorials: {stats.tutorials}</li>
						<li>Total Glossary Terms: {stats.glossary}</li>
					</ul>
				</section>
				<section
					css={{
						backgroundColor: "#fff",
						border: "1px solid #dfe3f1",
						borderRadius: "0.7rem",
						padding: "1rem",
					}}
				>
					<h2 css={{ margin: 0, fontSize: "1.1rem" }}>Quick Action: Like a URL</h2>
					<form
						method="post"
						css={{ marginTop: "0.8rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
					>
						<label>
							<span css={{ display: "block", marginBottom: "0.3rem", fontSize: "0.9rem" }}>
								URL
							</span>
							<input name="url" css={{ minWidth: "18rem", padding: "0.4rem 0.5rem" }} />
						</label>
						<button type="submit">Create Like</button>
					</form>
				</section>
				<section
					css={{
						backgroundColor: "#fff",
						border: "1px solid #dfe3f1",
						borderRadius: "0.7rem",
						padding: "1rem",
					}}
				>
					<h2 css={{ margin: 0, fontSize: "1.1rem" }}>Search Terms: Last 24hs</h2>
					<ul css={{ margin: "0.7rem 0 0", paddingLeft: "1rem", display: "grid", gap: "0.35rem" }}>
						{recentSearches.length === 0 ? (
							<li>No search terms yet.</li>
						) : (
							recentSearches.map((item, index) => <li key={item + String(index)}>{item}</li>)
						)}
					</ul>
				</section>
			</main>
		</CMSLayout>
	);
}

export function CMSResourcePage() {
	return ({
		activePath,
		emptyLabel = "No items found.",
		items = [],
		primaryCta,
		searchCta,
		searchLabel,
		title,
	}: CMSResourcePageProps) => (
		<CMSLayout title={title} activePath={activePath}>
			<main css={{ display: "grid", gap: "0.9rem" }}>
				<section
					css={{
						backgroundColor: "#fff",
						border: "1px solid #dfe3f1",
						borderRadius: "0.7rem",
						padding: "1rem",
					}}
				>
					<h2 css={{ margin: 0, fontSize: "1.1rem" }}>{title}</h2>
					<form
						method="get"
						css={{ marginTop: "0.8rem", display: "flex", gap: "0.55rem", flexWrap: "wrap" }}
					>
						<label>
							<span css={{ display: "block", marginBottom: "0.3rem", fontSize: "0.9rem" }}>
								{searchLabel}
							</span>
							<input name="q" css={{ minWidth: "18rem", padding: "0.4rem 0.5rem" }} />
						</label>
						<button type="submit">{searchCta}</button>
						{primaryCta && (
							<a href={primaryCta.href} css={{ alignSelf: "end" }}>
								{primaryCta.label}
							</a>
						)}
					</form>
				</section>
				<section
					css={{
						backgroundColor: "#fff",
						border: "1px solid #dfe3f1",
						borderRadius: "0.7rem",
						padding: "1rem",
					}}
				>
					{items.length === 0 ? (
						<p css={{ margin: 0 }}>{emptyLabel}</p>
					) : (
						<ul css={{ margin: 0, paddingLeft: "1rem", display: "grid", gap: "0.4rem" }}>
							{items.map((item) => (
								<li key={item.href}>
									<a href={item.href}>{item.label}</a>
								</li>
							))}
						</ul>
					)}
				</section>
			</main>
		</CMSLayout>
	);
}

export function CMSActionPage() {
	return ({ activePath, description, title }: CMSActionPageProps) => (
		<CMSLayout title={title} activePath={activePath}>
			<main>
				<section
					css={{
						backgroundColor: "#fff",
						border: "1px solid #dfe3f1",
						borderRadius: "0.7rem",
						padding: "1rem",
						display: "grid",
						gap: "0.45rem",
					}}
				>
					<h2 css={{ margin: 0, fontSize: "1.1rem" }}>{title}</h2>
					<p css={{ margin: 0 }}>{description}</p>
				</section>
			</main>
		</CMSLayout>
	);
}
