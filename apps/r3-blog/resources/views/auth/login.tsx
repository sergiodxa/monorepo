/**
 * View for the login page. Renders a centered heading, explanatory copy, an
 * optional error message, and a form whose submit button kicks off the OAuth
 * login action to authenticate for CMS access. Exists as the entry point users
 * hit before reaching admin-only routes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { css } from "remix/ui";

import { BlogLayout } from "~/resources/components/layout/blog";
import routes from "~/routes/web";

/**
 * Groups type contracts used by the login view renderer.
 */
export namespace LoginView {
	/**
	 * Carries server-provided state for rendering the login page.
	 */
	export interface Model {
		error?: string;
	}
}

/**
 * Builds the login page renderer used by the auth route.
 * @returns A view function that renders the login screen from the route model.
 */
export function LoginView() {
	return ({ model }: { model: LoginView.Model }) => (
		<BlogLayout
			title="Login"
			description="Authenticate to access CMS tools"
			activePath={routes.auth.login.index.href()}
		>
			<main
				mix={[css({ display: "grid", gap: "1rem", justifyItems: "center", textAlign: "center" })]}
			>
				<h1 mix={[css({ margin: 0, fontSize: "2.4rem", color: "var(--ui-neutral-fg-emphasis)" })]}>
					Login
				</h1>

				<p
					mix={[
						css({ margin: 0, maxWidth: "55ch", color: "var(--ui-neutral-fg)", lineHeight: 1.4 }),
					]}
				>
					Authenticate with your account to access CMS routes.
				</p>

				{model.error && (
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
						{model.error}
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
		</BlogLayout>
	);
}
