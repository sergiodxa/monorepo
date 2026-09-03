/**
 * View for the logout confirmation page: a centered heading, a confirmation
 * prompt, and a form whose submit posts to the logout action, requiring an
 * explicit step before the session ends.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { contents, gap, grid, place } from "@sdxc/u/layout";
import { m, maxIs } from "@sdxc/u/size";
import { text, textAlign } from "@sdxc/u/typography";
import { Button, Form, Heading } from "@sdxc/ui";

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
 * Creates the logout page renderer. The confirmation is the submit itself, so
 * the form renders as `display: contents` with the button directly in the
 * centered grid, in the danger tone that marks sign-out as destructive.
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

				<Form
					action={routes.auth.logout.action.href()}
					method={routes.auth.logout.action.method}
					mix={[contents()]}
				>
					<Button type="submit" color="danger" size="lg">
						Sign out
					</Button>
				</Form>
			</main>
		</BlogLayout>
	);
}
