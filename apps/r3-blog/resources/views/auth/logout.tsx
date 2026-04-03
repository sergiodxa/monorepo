import { css } from "remix/component";

import { BlogLayout } from "~/resources/components/layout/blog";
import routes from "~/routes/web";

/**
 * Groups type contracts used by the logout view.
 */
export namespace LogoutView {
	/**
	 * Data available to the logout page renderer.
	 */
	export interface Model {}
}

/**
 * Creates the logout page renderer with confirmation UI and sign-out form.
 */
export function LogoutView() {
	return ({ model: _model }: { model: LogoutView.Model }) => (
		<BlogLayout
			title="Logout"
			description="Sign out from CMS"
			activePath={routes.auth.logout.index.href()}
		>
			<main
				mix={[css({ display: "grid", gap: "1rem", justifyItems: "center", textAlign: "center" })]}
			>
				<h1 mix={[css({ margin: 0, fontSize: "2.4rem", color: "var(--ui-neutral-fg-emphasis)" })]}>
					Logout
				</h1>

				<p
					mix={[
						css({ margin: 0, maxWidth: "55ch", color: "var(--ui-neutral-fg)", lineHeight: 1.4 }),
					]}
				>
					Are you sure you want to sign out from CMS?
				</p>

				<form
					action={routes.auth.logout.action.href()}
					method={routes.auth.logout.action.method}
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
						Sign out
					</button>
				</form>
			</main>
		</BlogLayout>
	);
}
