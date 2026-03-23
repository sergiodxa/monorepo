export namespace ArticlesView {
	export interface Item {
		href: string;
		label: string;
		preview?: boolean;
	}

	export interface Props {
		items: Array<Item>;
	}
}

export function articlePath(slug: string) {
	return `/articles/${slug}`;
}

export function ArticlesView() {
	return ({ items }: ArticlesView.Props) => (
		<main css={{ display: "grid", gap: "0.85rem" }}>
			<h1 css={{ margin: 0, fontSize: "2rem", color: "var(--ui-neutral-fg-emphasis)" }}>
				Articles
			</h1>
			<p
				css={{
					margin: 0,
					color: "var(--ui-neutral-fg)",
					maxWidth: "52ch",
					fontSize: "1.05rem",
					lineHeight: 1.35,
				}}
			>
				These are my articles.
			</p>
			<p css={{ margin: 0, color: "var(--ui-neutral-fg)", fontSize: "1.05rem" }}>
				Subscribe to my articles using <a href="/articles.rss">RSS</a>.
			</p>
			{items.length === 0 ? (
				<p css={{ margin: 0, color: "var(--ui-neutral-fg)" }}>No articles yet.</p>
			) : (
				<ul css={{ margin: "0.4rem 0 0", paddingLeft: "1.1rem", display: "grid", gap: "0.55rem" }}>
					{items.map((item) => (
						<li key={item.href} css={{ fontSize: "1.05rem", lineHeight: 1.25 }}>
							<a href={item.href} css={{ color: "var(--ui-accent-fg)" }}>
								{item.label}
							</a>
							{item.preview && (
								<span
									css={{
										marginLeft: "0.35rem",
										color: "var(--ui-accent-fg-emphasis)",
										fontSize: "0.8rem",
									}}
								>
									Preview
								</span>
							)}
						</li>
					))}
				</ul>
			)}
		</main>
	);
}
