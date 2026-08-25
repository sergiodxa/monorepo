/**
 * View for the login page: a centered heading, explanatory copy, an optional
 * error message, and a single-submit form that starts the OAuth login action
 * for CMS access.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border, fg, surface } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { contents, gap, grid, place } from "@pkg/u/layout";
import { m, maxIs, p } from "@pkg/u/size";
import { text, textAlign } from "@pkg/u/typography";
import { Button, Form, Heading } from "@pkg/ui";

import { BlogLayout } from "~/resources/layouts/blog";
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
 * Builds the login page renderer used by the auth route. The form's only
 * control is the submit that hands off to the OAuth provider, so it renders as
 * `display: contents` and the button sits directly in the centered grid.
 *
 * @returns A view function that renders the login screen from the route model.
 */
export function LoginView() {
	return ({ model }: { model: LoginView.Model }) => (
		<BlogLayout
			title="Login"
			description="Authenticate to access CMS tools"
			activePath={routes.auth.login.index.href()}
		>
			<main mix={[grid(), gap(4), place({ items: "center" }), textAlign("center")]}>
				<Heading level={1} mix={[m(0), text("4xl")]}>
					Login
				</Heading>

				<p mix={[m(0), maxIs("55ch"), fg("neutral")]}>
					Authenticate with your account to access CMS routes.
				</p>

				{model.error && (
					<p mix={[m(0), p(2, 3), rounded("md"), surface("danger.tinted"), border({ width: 1 })]}>
						{model.error}
					</p>
				)}

				<Form
					action={routes.auth.login.action.href()}
					method={routes.auth.login.action.method}
					mix={[contents()]}
				>
					<Button type="submit" color="brand" size="lg">
						Continue with Auth
					</Button>
				</Form>
			</main>
		</BlogLayout>
	);
}
