export namespace CMSTutorialsIndexView {
	export interface Item {
		id: string;
		title: string;
		slug: string;
	}

	export interface Props {
		items: Array<Item>;
	}
}

export namespace CMSTutorialsActionView {
	export interface Props {
		title: string;
		description: string;
	}
}

export function CMSTutorialsIndexView() {
	return ({ items }: CMSTutorialsIndexView.Props) => (
		<main css={{ display: "grid", gap: "0.9rem" }}>
			<section
				css={{
					backgroundColor: "var(--ui-neutral-bg-tint)",
					border: "1px solid var(--ui-neutral-border)",
					borderRadius: "0.7rem",
					padding: "1rem",
				}}
			>
				<h2 css={{ margin: 0, fontSize: "1.1rem" }}>Tutorials</h2>
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
					<a href="/cms/tutorials/new" css={{ alignSelf: "end" }}>
						New Tutorial
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
					<p css={{ margin: 0 }}>No tutorials found in the database yet.</p>
				) : (
					<ul css={{ margin: 0, paddingLeft: "1rem", display: "grid", gap: "0.4rem" }}>
						{items.map((item) => (
							<li key={item.id}>
								<a href={`/cms/tutorials/${item.id}`}>
									{`${item.title} (/tutorials/${item.slug})`}
								</a>
							</li>
						))}
					</ul>
				)}
			</section>
		</main>
	);
}

export function CMSTutorialsActionView() {
	return ({ description, title }: CMSTutorialsActionView.Props) => (
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
