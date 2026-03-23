export namespace FeedView {
	export interface ActivityItem {
		href: string;
		label: string;
		date: string;
		preview?: boolean;
		icon: string;
	}

	export interface Props {
		activity: Array<ActivityItem>;
	}
}

function formatDate(value: string) {
	let date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString("en", { month: "short", day: "2-digit", year: "2-digit" });
}

export function FeedView() {
	return ({ activity }: FeedView.Props) => (
		<main css={{ display: "grid", gap: "0.95rem" }}>
			<h1
				css={{
					fontSize: "2.2rem",
					margin: 0,
					lineHeight: 1.05,
					color: "var(--ui-neutral-fg-emphasis)",
				}}
			>
				Sergio Xalambrí
			</h1>
			<p
				css={{
					margin: 0,
					color: "var(--ui-neutral-fg)",
					maxWidth: "60ch",
					fontSize: "1.08rem",
					lineHeight: 1.4,
				}}
			>
				Web Developer from Buenos Aires with 10+ years of experience. I work at
				<strong> Daffy</strong> and maintain several open-source libraries around React Router and
				OAuth2.
			</p>
			<p css={{ margin: "0.2rem 0 0", color: "var(--ui-neutral-fg)", fontSize: "1.05rem" }}>
				Subscribe to my content using <a href="/atom.xml">RSS</a>.
			</p>

			<h2
				css={{ margin: "0.5rem 0 0", fontSize: "1.4rem", color: "var(--ui-neutral-fg-emphasis)" }}
			>
				Activity
			</h2>

			<ol css={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.9rem" }}>
				{activity.map((item, index) => (
					<li
						key={item.href + String(index)}
						css={{
							display: "grid",
							gridTemplateColumns: "1.8rem 1fr auto",
							gap: "0.8rem",
							alignItems: "start",
						}}
					>
						<span
							aria-hidden
							css={{
								display: "inline-flex",
								justifyContent: "center",
								alignItems: "center",
								width: "1.8rem",
								height: "1.8rem",
								fontSize: "1.25rem",
							}}
						>
							{item.icon}
						</span>
						<p
							css={{
								margin: 0,
								fontSize: "1.05rem",
								color: "var(--ui-neutral-fg-emphasis)",
								lineHeight: 1.4,
							}}
						>
							<a href={item.href}>{item.label}</a>
							{item.preview && (
								<span
									css={{
										marginLeft: "0.4rem",
										fontSize: "0.85rem",
										color: "var(--ui-accent-fg-emphasis)",
									}}
								>
									Preview
								</span>
							)}
						</p>
						<time
							css={{
								color: "var(--ui-neutral-fg-muted)",
								fontSize: "0.95rem",
								whiteSpace: "nowrap",
								marginTop: "0.1rem",
							}}
						>
							{formatDate(item.date)}
						</time>
					</li>
				))}
			</ol>
		</main>
	);
}
