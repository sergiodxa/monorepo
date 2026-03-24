export namespace CMSGlossaryIndexView {
	export interface Item {
		id: string;
		term: string;
		slug: string;
		href: string;
	}

	export interface Props {
		items: Array<Item>;
	}
}

export namespace CMSGlossaryActionView {
	export interface FormValues {
		term: string;
		title: string;
		slug: string;
		definition: string;
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

export function CMSGlossaryIndexView() {
	return ({ items }: CMSGlossaryIndexView.Props) => (
		<main css={{ display: "grid", gap: "0.9rem" }}>
			<section
				css={{
					backgroundColor: "var(--ui-neutral-bg-tint)",
					border: "1px solid var(--ui-neutral-border)",
					borderRadius: "0.7rem",
					padding: "1rem",
				}}
			>
				<h2 css={{ margin: 0, fontSize: "1.1rem" }}>Glossary</h2>
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
					<a href="/cms/glossary/new" css={{ alignSelf: "end" }}>
						New Glossary
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
					<p css={{ margin: 0 }}>No glossary terms found in the database yet.</p>
				) : (
					<ul css={{ margin: 0, paddingLeft: "1rem", display: "grid", gap: "0.4rem" }}>
						{items.map((item) => (
							<li key={item.id}>
								<a href={item.href}>{`${item.term} (/glossary/${item.slug})`}</a>
							</li>
						))}
					</ul>
				)}
			</section>
		</main>
	);
}

export function CMSGlossaryActionView() {
	return ({
		action,
		deleteAction,
		description,
		mode,
		submitLabel,
		title,
		values,
	}: CMSGlossaryActionView.Props) => (
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
						<span>Term</span>
						<input name="term" defaultValue={values.term} required />
					</label>

					<label css={{ display: "grid", gap: "0.25rem" }}>
						<span>Title</span>
						<input name="title" defaultValue={values.title} />
					</label>

					<label css={{ display: "grid", gap: "0.25rem" }}>
						<span>Slug</span>
						<input name="slug" defaultValue={values.slug} required />
					</label>

					<label css={{ display: "grid", gap: "0.25rem" }}>
						<span>Published At (ISO)</span>
						<input name="published_at" defaultValue={values.published_at} />
					</label>

					<label css={{ display: "grid", gap: "0.25rem" }}>
						<span>Definition</span>
						<textarea name="definition" rows={8} defaultValue={values.definition} required />
					</label>

					<div css={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
						<button type="submit">{submitLabel}</button>
						<a href="/cms/glossary">Back to list</a>
					</div>
				</form>

				{mode === "edit" && deleteAction ? (
					<section css={{ display: "grid", gap: "0.45rem" }}>
						<button type="button" commandfor="delete-glossary" command="show-modal">
							Delete Glossary
						</button>

						<dialog id="delete-glossary">
							<form method="post" action={deleteAction} css={{ display: "grid", gap: "0.5rem" }}>
								<input type="hidden" name="_method" value="DELETE" />
								<p css={{ margin: 0 }}>This action cannot be undone.</p>
								<div css={{ display: "flex", gap: "0.5rem" }}>
									<button type="submit">Confirm delete</button>
									<button type="button" commandfor="delete-glossary" command="close">
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
