export namespace LoginView {
	export interface Props {
		next: string;
		error?: string;
	}
}

export function LoginView() {
	return ({ error, next }: LoginView.Props) => (
		<main css={{ display: "grid", gap: "1rem", justifyItems: "center", textAlign: "center" }}>
			<h1 css={{ margin: 0, fontSize: "2.4rem", color: "var(--ui-neutral-fg-emphasis)" }}>Login</h1>
			<p css={{ margin: 0, maxWidth: "55ch", color: "var(--ui-neutral-fg)", lineHeight: 1.4 }}>
				Authenticate with your account to access CMS routes.
			</p>
			{error && (
				<p
					css={{
						margin: 0,
						padding: "0.55rem 0.8rem",
						borderRadius: "0.55rem",
						backgroundColor: "var(--ui-accent-bg-tint)",
						border: "1px solid var(--ui-accent-border)",
						color: "var(--ui-accent-fg-emphasis)",
					}}
				>
					{error}
				</p>
			)}
			<a
				href={`/login?start=1&next=${encodeURIComponent(next)}`}
				css={{
					textDecoration: "none",
					backgroundColor: "var(--ui-accent-bg-solid)",
					color: "var(--ui-accent-fg-on-solid)",
					padding: "0.65rem 1rem",
					borderRadius: "0.6rem",
					fontWeight: 700,
				}}
			>
				Continue with Auth
			</a>
		</main>
	);
}
