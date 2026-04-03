import { css } from "remix/component";

export namespace PostRelatedView {
	export interface Item {
		href: string;
		label: string;
		reason: string;
	}

	export interface Model {
		items: Array<Item>;
	}
}

export function PostRelatedView() {
	return ({ model }: { model: PostRelatedView.Model }) => {
		if (model.items.length === 0) return <></>;

		return (
			<section mix={[css({ display: "grid", gap: "1rem" })]}>
				<h2 mix={[css({ margin: 0, color: "var(--ui-neutral-fg-emphasis)", fontSize: "1.5rem" })]}>
					Related tutorials
				</h2>
				<div
					mix={[
						css({
							display: "grid",
							gap: "0.9rem",
							gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
						}),
					]}
				>
					{model.items.map((item) => (
						<article
							key={item.href}
							mix={[
								css({
									border: "1px solid var(--ui-neutral-border)",
									borderRadius: "0.8rem",
									padding: "0.9rem",
									backgroundColor: "var(--ui-neutral-bg-tint)",
								}),
							]}
						>
							<a
								href={item.href}
								mix={[
									css({
										fontSize: "1.05rem",
										fontWeight: 700,
										color: "var(--ui-accent-fg)",
									}),
								]}
							>
								{item.label}
							</a>
							<p mix={[css({ margin: "0.6rem 0 0", color: "var(--ui-neutral-fg)" })]}>
								{item.reason}
							</p>
						</article>
					))}
				</div>
			</section>
		);
	};
}
