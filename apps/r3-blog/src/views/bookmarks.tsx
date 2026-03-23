export namespace BookmarksView {
	export interface Item {
		href: string;
		label: string;
		preview?: boolean;
		suffixHref?: string;
		suffixLabel?: string;
		suffixAriaLabel?: string;
		suffixTitle?: string;
	}

	export interface Props {
		items: Array<Item>;
	}
}

function normalizeBookmarkHref(rawHref: string) {
	if (rawHref.startsWith("http://") || rawHref.startsWith("https://")) {
		return rawHref;
	}

	if (rawHref.startsWith("/")) {
		return rawHref;
	}

	return `https://${rawHref}`;
}

export function BookmarksView() {
	return ({ items }: BookmarksView.Props) => (
		<main css={{ display: "grid", gap: "0.85rem" }}>
			<h1 css={{ margin: 0, fontSize: "2rem", color: "var(--ui-neutral-fg-emphasis)" }}>
				Bookmarks
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
				Links that I read and liked.
			</p>
			<p css={{ margin: 0, color: "var(--ui-neutral-fg)", fontSize: "1.05rem" }}>
				Subscribe to my bookmarks using <a href="/bookmarks.rss">RSS</a>.
			</p>
			{items.length === 0 ? (
				<p css={{ margin: 0, color: "var(--ui-neutral-fg)" }}>No bookmarks yet.</p>
			) : (
				<ul css={{ margin: "0.4rem 0 0", paddingLeft: "1.1rem", display: "grid", gap: "0.55rem" }}>
					{items.map((item) => (
						<li key={item.href} css={{ fontSize: "1.05rem", lineHeight: 1.25 }}>
							<a href={normalizeBookmarkHref(item.href)} css={{ color: "var(--ui-accent-fg)" }}>
								{item.label}
							</a>
							{item.suffixHref && item.suffixLabel && (
								<>
									{" - "}
									<a
										href={normalizeBookmarkHref(item.suffixHref)}
										aria-label={item.suffixAriaLabel}
										title={item.suffixTitle}
										css={{ color: "var(--ui-accent-fg)", textDecoration: "none" }}
									>
										{item.suffixLabel}
									</a>
								</>
							)}
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
