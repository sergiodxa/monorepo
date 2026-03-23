export namespace CMSArticlesIndexView {
	export interface Item {
		id: string;
		title: string;
		slug: string;
	}

	export interface Props {
		items: Array<Item>;
	}
}

export namespace CMSArticlesActionView {
	export interface Props {
		title: string;
		description: string;
	}
}

export function CMSArticlesIndexView() {
	return ({ items }: CMSArticlesIndexView.Props) => (
		<main css={{ display: "grid", gap: "0.9rem" }}>
			<section
				css={{
					backgroundColor: "var(--ui-neutral-bg-tint)",
					border: "1px solid var(--ui-neutral-border)",
					borderRadius: "0.7rem",
					padding: "1rem",
				}}
			>
				<h2 css={{ margin: 0, fontSize: "1.1rem" }}>Articles</h2>
				<form
					method="get"
					css={{ marginTop: "0.8rem", display: "flex", gap: "0.55rem", flexWrap: "wrap" }}
				>
					<label>
						<span css={{ display: "block", marginBottom: "0.3rem", fontSize: "0.9rem" }}>
							What're you looking for?
						</span>
						<input name="q" css={{ minWidth: "18rem", padding: "0.4rem 0.5rem" }} />
					</label>
					<button type="submit">Search</button>
					<a href="/cms/articles/new" css={{ alignSelf: "end" }}>
						New Article
					</a>
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
				{items.length === 0 ? (
					<p css={{ margin: 0 }}>No articles found in the database yet.</p>
				) : (
					<ul css={{ margin: 0, paddingLeft: "1rem", display: "grid", gap: "0.4rem" }}>
						{items.map((item) => (
							<li key={item.id}>
								<a href={`/cms/articles/${item.id}`}>{`${item.title} (/articles/${item.slug})`}</a>
							</li>
						))}
					</ul>
				)}
			</section>
		</main>
	);
}

export function CMSArticlesActionView() {
	return ({ description, title }: CMSArticlesActionView.Props) => (
		<main>
			<section
				css={{
					backgroundColor: "var(--ui-neutral-bg-tint)",
					border: "1px solid var(--ui-neutral-border)",
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
	);
}
