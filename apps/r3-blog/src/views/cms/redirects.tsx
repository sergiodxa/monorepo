export namespace CMSRedirectsIndexView {
	export interface Item {
		from: string;
		to: string;
		status: number;
		href: string;
	}

	export interface Props {
		items: Array<Item>;
	}
}

export namespace CMSRedirectsActionView {
	export interface FormValues {
		from: string;
		to: string;
		status: string;
	}

	export interface Props {
		title: string;
		description: string;
		mode: "new" | "show";
		action: string;
		submitLabel: string;
		deleteAction?: string;
		values: FormValues;
	}
}

export function CMSRedirectsIndexView() {
	return ({ items }: CMSRedirectsIndexView.Props) => (
		<main css={{ display: "grid", gap: "0.9rem" }}>
			<section
				css={{
					backgroundColor: "var(--ui-neutral-bg-tint)",
					border: "1px solid var(--ui-neutral-border)",
					borderRadius: "0.7rem",
					padding: "1rem",
				}}
			>
				<h2 css={{ margin: 0, fontSize: "1.1rem" }}>Redirects</h2>
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
					<a href="/cms/redirects/new" css={{ alignSelf: "end" }}>
						New Redirect
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
					<p css={{ margin: 0 }}>No redirects found in KV yet.</p>
				) : (
					<ul css={{ margin: 0, paddingLeft: "1rem", display: "grid", gap: "0.4rem" }}>
						{items.map((item) => (
							<li key={item.href}>
								<a href={item.href}>{`${item.from} -> ${item.to} (${String(item.status)})`}</a>
							</li>
						))}
					</ul>
				)}
			</section>
		</main>
	);
}

export function CMSRedirectsActionView() {
	return ({
		action,
		deleteAction,
		description,
		mode,
		submitLabel,
		title,
		values,
	}: CMSRedirectsActionView.Props) => (
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
					<label css={{ display: "grid", gap: "0.25rem" }}>
						<span>From</span>
						<input name="from" defaultValue={values.from} required readOnly={mode === "show"} />
					</label>

					<label css={{ display: "grid", gap: "0.25rem" }}>
						<span>To</span>
						<input name="to" defaultValue={values.to} required readOnly={mode === "show"} />
					</label>

					<label css={{ display: "grid", gap: "0.25rem" }}>
						<span>Status</span>
						<select name="status" defaultValue={values.status} disabled={mode === "show"}>
							<option value="301">301</option>
							<option value="302">302</option>
							<option value="307">307</option>
							<option value="308">308</option>
						</select>
					</label>

					{mode === "new" ? (
						<div css={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
							<button type="submit">{submitLabel}</button>
							<a href="/cms/redirects">Back to list</a>
						</div>
					) : null}
				</form>

				{mode === "show" && deleteAction ? (
					<section css={{ display: "grid", gap: "0.45rem" }}>
						<div css={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
							<a href={values.from}>Visit source path</a>
							<a href="/cms/redirects">Back to list</a>
						</div>

						<button type="button" commandfor="delete-redirect" command="show-modal">
							Delete Redirect
						</button>

						<dialog id="delete-redirect">
							<form method="post" action={deleteAction} css={{ display: "grid", gap: "0.5rem" }}>
								<input type="hidden" name="_method" value="DELETE" />
								<p css={{ margin: 0 }}>This action cannot be undone.</p>
								<div css={{ display: "flex", gap: "0.5rem" }}>
									<button type="submit">Confirm delete</button>
									<button type="button" commandfor="delete-redirect" command="close">
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
