/**
 * View for the logout confirmation page. Renders a centered heading, a
 * "are you sure" prompt, and a form whose submit button posts to the logout
 * action to sign the user out of the CMS. Exists to require an explicit
 * confirmation step before ending the session.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@pkg/u/color";
import { contents, gap, grid, place } from "@pkg/u/layout";
import { m, maxIs } from "@pkg/u/size";
import { text, textAlign } from "@pkg/u/typography";
import { Button, Form, Heading } from "@pkg/ui";

import { BlogLayout } from "~/resources/layouts/blog";
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
			<main mix={[grid(), gap(4), place({ items: "center" }), textAlign("center")]}>
				<Heading level={1} mix={[m(0), text("4xl")]}>
					Logout
				</Heading>

				<p mix={[m(0), maxIs("55ch"), fg("neutral")]}>
					Are you sure you want to sign out from CMS?
				</p>

				{/* The form carries no fields of its own — the confirmation is the submit
				itself — so it stays `display: contents` and lets the button sit directly in
				the page's centered grid. */}
				<Form
					action={routes.auth.logout.action.href()}
					method={routes.auth.logout.action.method}
					mix={[contents()]}
				>
					{/* Ending a session is destructive, so the confirm button reads in the
					danger tone rather than the brand one. */}
					<Button type="submit" color="danger" size="lg">
						Sign out
					</Button>
				</Form>
			</main>
		</BlogLayout>
	);
}
