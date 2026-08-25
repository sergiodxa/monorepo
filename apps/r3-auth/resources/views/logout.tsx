/**
 * The logout confirmation page: the interactive way out of the identity provider,
 * shown when a browser reaches `/oidc/logout` without a usable RP-initiated logout
 * request. Posting the same URL back to itself keeps sign-out a deliberate action
 * that only this page's own form can start.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { flex, flexCol, items, justify } from "@pkg/u/layout";
import { is, maxIs, minBs, p } from "@pkg/u/size";
import { textAlign } from "@pkg/u/typography";
import { Button, Card, Form } from "@pkg/ui";

import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

namespace LogoutView {
	export interface Setup {
		/** Document title, translated by the caller. */
		documentTitle: string;
		/** The question above the button. */
		title: string;
		/** Label of the button that performs the sign-out. */
		cta: string;
	}
}

/**
 * Renders the sign-out confirmation form.
 *
 * The confirmation renders as static markup, picking up the palette, reset and
 * token layer straight from the shared document layout.
 */
export default function LogoutView(handle: Handle<LogoutView.Setup>) {
	return () => {
		let { documentTitle, title, cta } = handle.props;

		return (
			<DocumentLayout title={documentTitle} clientRuntime={false}>
				<main mix={[flex(), flexCol(), items("center"), justify("center"), minBs("100dvh"), p(6)]}>
					<Card mix={[is("100%"), maxIs("22.5rem")]}>
						<Card.Header mix={[textAlign("center")]}>
							<Card.Title>{title}</Card.Title>
						</Card.Header>

						<Card.Content>
							<Form method="post" action={routes.oidc.logout.action.href()}>
								<Button type="submit" color="danger" mix={[is("100%")]}>
									{cta}
								</Button>
							</Form>
						</Card.Content>
					</Card>
				</main>
			</DocumentLayout>
		);
	};
}
