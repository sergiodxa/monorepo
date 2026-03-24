import { Button } from "~/components/button";
import { Input } from "~/components/input";

export namespace CMSDashboardView {
	export interface Stats {
		articles: number;
		likes: number;
		tutorials: number;
		glossary: number;
	}

	export interface Props {
		stats: Stats;
	}
}

export function CMSDashboardView() {
	return ({ stats }: CMSDashboardView.Props) => (
		<main css={{ display: "grid", gap: "0.9rem" }}>
			<h2
				css={{
					position: "absolute",
					width: "1px",
					height: "1px",
					padding: 0,
					margin: "-1px",
					overflow: "hidden",
					clip: "rect(0,0,0,0)",
					whiteSpace: "nowrap",
					borderWidth: 0,
				}}
			>
				Post Stats
			</h2>
			<div
				css={{
					display: "grid",
					gap: "0.65rem",
					gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))",
				}}
			>
				<article
					css={{
						backgroundColor: "var(--ui-neutral-bg-tint)",
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "0.6rem",
						padding: "0.8rem",
						display: "grid",
						gap: "0.25rem",
					}}
				>
					<p css={{ margin: 0, fontSize: "0.85rem", color: "var(--ui-neutral-fg)" }}>
						Total Articles
					</p>
					<p
						css={{
							margin: 0,
							fontSize: "1.8rem",
							fontWeight: 700,
							color: "var(--ui-neutral-fg-emphasis)",
						}}
					>
						{stats.articles}
					</p>
					<a href="/cms/articles" css={{ fontSize: "0.85rem", color: "var(--ui-accent-fg)" }}>
						View all
					</a>
				</article>
				<article
					css={{
						backgroundColor: "var(--ui-neutral-bg-tint)",
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "0.6rem",
						padding: "0.8rem",
						display: "grid",
						gap: "0.25rem",
					}}
				>
					<p css={{ margin: 0, fontSize: "0.85rem", color: "var(--ui-neutral-fg)" }}>Total Likes</p>
					<p
						css={{
							margin: 0,
							fontSize: "1.8rem",
							fontWeight: 700,
							color: "var(--ui-neutral-fg-emphasis)",
						}}
					>
						{stats.likes}
					</p>
					<a href="/cms/bookmarks" css={{ fontSize: "0.85rem", color: "var(--ui-accent-fg)" }}>
						View all
					</a>
				</article>
				<article
					css={{
						backgroundColor: "var(--ui-neutral-bg-tint)",
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "0.6rem",
						padding: "0.8rem",
						display: "grid",
						gap: "0.25rem",
					}}
				>
					<p css={{ margin: 0, fontSize: "0.85rem", color: "var(--ui-neutral-fg)" }}>
						Total Tutorials
					</p>
					<p
						css={{
							margin: 0,
							fontSize: "1.8rem",
							fontWeight: 700,
							color: "var(--ui-neutral-fg-emphasis)",
						}}
					>
						{stats.tutorials}
					</p>
					<a href="/cms/tutorials" css={{ fontSize: "0.85rem", color: "var(--ui-accent-fg)" }}>
						View all
					</a>
				</article>
				<article
					css={{
						backgroundColor: "var(--ui-neutral-bg-tint)",
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "0.6rem",
						padding: "0.8rem",
						display: "grid",
						gap: "0.25rem",
					}}
				>
					<p css={{ margin: 0, fontSize: "0.85rem", color: "var(--ui-neutral-fg)" }}>
						Total Glossary Terms
					</p>
					<p
						css={{
							margin: 0,
							fontSize: "1.8rem",
							fontWeight: 700,
							color: "var(--ui-neutral-fg-emphasis)",
						}}
					>
						{stats.glossary}
					</p>
					<a href="/cms/glossary" css={{ fontSize: "0.85rem", color: "var(--ui-accent-fg)" }}>
						View all
					</a>
				</article>
			</div>
			<section
				css={{
					backgroundColor: "var(--ui-neutral-bg-tint)",
					border: "1px solid var(--ui-neutral-border)",
					borderRadius: "0.7rem",
					padding: "1rem",
				}}
			>
				<h2 css={{ margin: 0, fontSize: "1.1rem", color: "var(--ui-neutral-fg-emphasis)" }}>
					Quick Action: Like a URL
				</h2>
				<form
					method="post"
					css={{
						marginTop: "0.8rem",
						display: "flex",
						gap: "0.55rem",
						flexWrap: "wrap",
						alignItems: "end",
					}}
				>
					<label css={{ display: "grid", gap: "0.25rem" }}>
						<span css={{ fontSize: "0.9rem", color: "var(--ui-neutral-fg)" }}>URL</span>
						<Input name="url" css={{ minWidth: "18rem" }} />
					</label>
					<Button type="submit">Create Like</Button>
				</form>
			</section>
		</main>
	);
}
