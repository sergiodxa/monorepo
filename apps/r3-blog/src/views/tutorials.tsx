import { css } from "remix/component";

export namespace TutorialsView {
	export interface Item {
		href: string;
		label: string;
		preview?: boolean;
	}

	export interface Props {
		items: Array<Item>;
	}
}

export function tutorialPathFromSlug(slug: string) {
	return `/tutorials/${slug}`;
}

export function TutorialsView() {
	return ({ items }: TutorialsView.Props) => (
		<main mix={[css({ display: "grid", gap: "0.85rem" })]}>
			<h1 mix={[css({ margin: 0, fontSize: "2rem", color: "var(--ui-neutral-fg-emphasis)" })]}>
				Tutorials
			</h1>
			<p
				mix={[
					css({
						margin: 0,
						color: "var(--ui-neutral-fg)",
						maxWidth: "52ch",
						fontSize: "1.05rem",
						lineHeight: 1.35,
					}),
				]}
			>
				Learn about Remix, React, and more.
			</p>
			<p mix={[css({ margin: 0, color: "var(--ui-neutral-fg)", fontSize: "1.05rem" })]}>
				Subscribe to my tutorials using <a href="/tutorials.rss">RSS</a>.
			</p>
			{items.length === 0 ? (
				<p mix={[css({ margin: 0, color: "var(--ui-neutral-fg)" })]}>No tutorials yet.</p>
			) : (
				<ul
					mix={[
						css({ margin: "0.4rem 0 0", paddingLeft: "1.1rem", display: "grid", gap: "0.55rem" }),
					]}
				>
					{items.map((item) => (
						<li key={item.href} mix={[css({ fontSize: "1.05rem", lineHeight: 1.25 })]}>
							<a href={item.href} mix={[css({ color: "var(--ui-accent-fg)" })]}>
								{item.label}
							</a>
							{item.preview && (
								<span
									mix={[
										css({
											marginLeft: "0.35rem",
											color: "var(--ui-accent-fg-emphasis)",
											fontSize: "0.8rem",
										}),
									]}
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
