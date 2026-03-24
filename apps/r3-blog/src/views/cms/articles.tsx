export namespace CMSArticlesIndexView {
	export interface Item {
		id: string;
		title: string;
		slug: string;
		href: string;
	}

	export interface Props {
		items: Array<Item>;
	}
}

export namespace CMSArticlesActionView {
	export interface FormValues {
		title: string;
		slug: string;
		locale: string;
		excerpt: string;
		canonical_url: string;
		content: string;
		published_at: string;
	}

	export interface Props {
		title: string;
		description: string;
		mode: "new" | "edit";
		action: string;
		submitLabel: string;
		deleteAction?: string;
		values: FormValues;
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
								<a href={item.href}>{`${item.title} (/articles/${item.slug})`}</a>
							</li>
						))}
					</ul>
				)}
			</section>
		</main>
	);
}

export function CMSArticlesActionView() {
	return ({
		action,
		deleteAction,
		description,
		mode,
		submitLabel,
		title,
		values,
	}: CMSArticlesActionView.Props) => (
		<main>
			<section
				css={{
					backgroundColor: "var(--ui-neutral-bg-tint)",
					border: "1px solid var(--ui-neutral-border)",
					borderRadius: "0.7rem",
					padding: "1rem",
					display: "grid",
					gap: "0.8rem",
				}}
			>
				<h2 css={{ margin: 0, fontSize: "1.1rem" }}>{title}</h2>
				<p css={{ margin: 0 }}>{description}</p>

				<form method="post" action={action} css={{ display: "grid", gap: "0.65rem" }}>
					{mode === "edit" ? <input type="hidden" name="_method" value="PUT" /> : null}

					<label css={{ display: "grid", gap: "0.25rem" }}>
						<span>Title</span>
						<input name="title" defaultValue={values.title} required />
					</label>

					<label css={{ display: "grid", gap: "0.25rem" }}>
						<span>Slug</span>
						<input name="slug" defaultValue={values.slug} required />
					</label>

					<label css={{ display: "grid", gap: "0.25rem" }}>
						<span>Locale</span>
						<input name="locale" defaultValue={values.locale} required />
					</label>

					<label css={{ display: "grid", gap: "0.25rem" }}>
						<span>Excerpt</span>
						<textarea name="excerpt" rows={3} defaultValue={values.excerpt} />
					</label>

					<label css={{ display: "grid", gap: "0.25rem" }}>
						<span>Canonical URL</span>
						<input name="canonical_url" defaultValue={values.canonical_url} />
					</label>

					<label css={{ display: "grid", gap: "0.25rem" }}>
						<span>Published At (ISO)</span>
						<input name="published_at" defaultValue={values.published_at} />
					</label>

					<label css={{ display: "grid", gap: "0.25rem" }}>
						<span>Content</span>
						<textarea name="content" rows={16} defaultValue={values.content} required />
					</label>

					<div css={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
						<button type="submit">{submitLabel}</button>
						<a href="/cms/articles">Back to list</a>
					</div>
				</form>

				{mode === "edit" && deleteAction ? (
					<section css={{ display: "grid", gap: "0.45rem" }}>
						<button type="button" commandfor="delete-article" command="show-modal">
							Delete Article
						</button>

						<dialog id="delete-article">
							<form method="post" action={deleteAction} css={{ display: "grid", gap: "0.5rem" }}>
								<input type="hidden" name="_method" value="DELETE" />
								<p css={{ margin: 0 }}>This action cannot be undone.</p>
								<div css={{ display: "flex", gap: "0.5rem" }}>
									<button type="submit">Confirm delete</button>
									<button type="button" commandfor="delete-article" command="close">
										Cancel
									</button>
								</div>
							</form>
						</dialog>
					</section>
				) : null}
			</section>
		</main>
	);
}
