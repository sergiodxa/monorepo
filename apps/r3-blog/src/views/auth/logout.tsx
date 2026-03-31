import routes from "~/routes";

export function LogoutView() {
	return () => (
		<main css={{ display: "grid", gap: "1rem", justifyItems: "center", textAlign: "center" }}>
			<h1 css={{ margin: 0, fontSize: "2.4rem", color: "var(--ui-neutral-fg-emphasis)" }}>
				Logout
			</h1>

			<p css={{ margin: 0, maxWidth: "55ch", color: "var(--ui-neutral-fg)", lineHeight: 1.4 }}>
				Are you sure you want to sign out from CMS?
			</p>

			<form
				action={routes.auth.logout.action.href()}
				method={routes.auth.logout.action.method}
				css={{ display: "contents" }}
			>
				<button
					type="submit"
					css={{
						textDecoration: "none",
						backgroundColor: "var(--ui-accent-bg-solid)",
						color: "var(--ui-accent-fg-on-solid)",
						padding: "0.65rem 1rem",
						borderRadius: "0.6rem",
						fontWeight: 700,
					}}
				>
					Sign out
				</button>
			</form>
		</main>
	);
}
