export namespace CMSDashboardView {
	export interface Stats {
		articles: number;
		likes: number;
		tutorials: number;
		glossary: number;
	}

	export interface Props {
		stats: Stats;
		recentSearches: Array<string>;
	}
}

export function CMSDashboardView() {
	return ({ recentSearches, stats }: CMSDashboardView.Props) => (
		<main css={{ display: "grid", gap: "0.9rem" }}>
			<section
				css={{
					backgroundColor: "var(--ui-neutral-bg-tint)",
					border: "1px solid var(--ui-neutral-border)",
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
					backgroundColor: "var(--ui-neutral-bg-tint)",
					border: "1px solid var(--ui-neutral-border)",
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
						<span css={{ display: "block", marginBottom: "0.3rem", fontSize: "0.9rem" }}>URL</span>
						<input name="url" css={{ minWidth: "18rem", padding: "0.4rem 0.5rem" }} />
					</label>
					<button type="submit">Create Like</button>
				</form>
			</section>
			<section
				css={{
					backgroundColor: "var(--ui-neutral-bg-tint)",
					border: "1px solid var(--ui-neutral-border)",
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
	);
}
