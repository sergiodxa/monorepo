import { css } from "remix/component";

import routes from "~/routes";

export namespace LoginView {
	export interface Props {
		error?: string;
	}
}

export function LoginView() {
	return ({ error }: LoginView.Props) => (
		<main
			mix={[css({ display: "grid", gap: "1rem", justifyItems: "center", textAlign: "center" })]}
		>
			<h1 mix={[css({ margin: 0, fontSize: "2.4rem", color: "var(--ui-neutral-fg-emphasis)" })]}>
				Login
			</h1>

			<p
				mix={[css({ margin: 0, maxWidth: "55ch", color: "var(--ui-neutral-fg)", lineHeight: 1.4 })]}
			>
				Authenticate with your account to access CMS routes.
			</p>

			{error && (
				<p
					mix={[
						css({
							margin: 0,
							padding: "0.55rem 0.8rem",
							borderRadius: "0.55rem",
							backgroundColor: "var(--ui-accent-bg-tint)",
							border: "1px solid var(--ui-accent-border)",
							color: "var(--ui-accent-fg-emphasis)",
						}),
					]}
				>
					{error}
				</p>
			)}

			<form
				action={routes.auth.login.action.href()}
				method={routes.auth.login.action.method}
				mix={[css({ display: "contents" })]}
			>
				<button
					type="submit"
					mix={[
						css({
							textDecoration: "none",
							backgroundColor: "var(--ui-accent-bg-solid)",
							color: "var(--ui-accent-fg-on-solid)",
							padding: "0.65rem 1rem",
							borderRadius: "0.6rem",
							fontWeight: 700,
						}),
					]}
				>
					Continue with Auth
				</button>
			</form>
		</main>
	);
}
