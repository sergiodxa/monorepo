export namespace GlossaryView {
	export interface Entry {
		id: string;
		slug: string;
		term: string;
		title?: string;
		definition: string;
	}

	export interface Props {
		entries: Array<Entry>;
	}
}

export function glossaryPathFromSlug(slug: string): string {
	return `/glossary/${slug}`;
}

export function GlossaryView() {
	return ({ entries }: GlossaryView.Props) => (
		<main css={{ display: "grid", gap: "1rem" }}>
			<h1 css={{ margin: 0, fontSize: "2rem", color: "var(--ui-neutral-fg-emphasis)" }}>
				Glossary
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
				My definition of some terms.
			</p>
			<dl css={{ margin: 0, display: "grid", gap: "1.1rem" }}>
				{entries.map((item) => (
					<div
						key={item.id}
						id={item.slug}
						css={{
							padding: "1rem",
							borderRadius: "0.65rem",
							border: "2px solid transparent",
							backgroundColor: "var(--ui-neutral-bg-tint)",
							transition:
								"background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
							":target": {
								borderColor: "var(--ui-accent-border-strong)",
								backgroundColor: "var(--ui-accent-bg-tint)",
								boxShadow: "0 0 0 3px var(--ui-accent-ring)",
							},
							":target dt": {
								color: "var(--ui-accent-fg-emphasis)",
							},
							":target dd": {
								color: "var(--ui-accent-fg)",
							},
							":target small": {
								color: "var(--ui-accent-fg-muted)",
							},
						}}
					>
						<dt
							css={{
								margin: 0,
								fontSize: "1.5rem",
								fontWeight: 700,
								color: "var(--ui-neutral-fg-emphasis)",
							}}
						>
							<a href={`#${item.slug}`} css={{ color: "inherit", textDecoration: "none" }}>
								{item.term}
								{item.title && (
									<small
										css={{
											marginLeft: "0.45rem",
											color: "var(--ui-neutral-fg-muted)",
											fontSize: "0.9rem",
										}}
									>
										(aka {item.title})
									</small>
								)}
							</a>
						</dt>
						<dd
							css={{
								margin: "0.4rem 0 0",
								color: "var(--ui-neutral-fg-emphasis)",
								fontSize: "1.05rem",
								lineHeight: 1.5,
							}}
						>
							{item.definition}
						</dd>
					</div>
				))}
			</dl>
		</main>
	);
}
