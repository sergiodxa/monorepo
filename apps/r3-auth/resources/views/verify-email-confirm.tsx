/**
 * The page a verification link lands on while its token is still unspent: the heading, one
 * sentence, and the single button whose submission is what actually confirms the address.
 *
 * The button exists because opening a link is not a decision anybody made. A mailbox is
 * read by scanners and link checkers as well as by its owner, and every one of them
 * follows the URL; only a person presses this. The token travels as a hidden field so the
 * request that spends it carries it in a body rather than in a URL.
 *
 * The address the token was issued for is never shown: the link is enough to reach this
 * page, and repeating the mailbox on it would tell whoever holds the link whose account it
 * belongs to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { flex, flexCol, items, justify } from "@pkg/u/layout";
import { is, maxIs, minBs, p } from "@pkg/u/size";
import { textAlign } from "@pkg/u/typography";
import { Button, Card, Form } from "@pkg/ui";

import routes from "~/routes/web";

namespace VerifyEmailConfirmView {
	export interface Props {
		/** Heading naming what the button will do. */
		title: string;
		/** The sentence under it. */
		description: string;
		/** The token this form spends, carried hidden. */
		token: string;
		/** Submit label. */
		submit: string;
	}
}

/** Renders the confirmation a live verification token is answered with. */
export default function VerifyEmailConfirmView(handle: Handle<VerifyEmailConfirmView.Props>) {
	return () => {
		let { title, description, token, submit } = handle.props;

		return (
			<main mix={[flex(), flexCol(), items("center"), justify("center"), minBs("100dvh"), p(6)]}>
				<Card mix={[is("100%"), maxIs("26rem")]}>
					<Card.Header mix={[textAlign("center")]}>
						<Card.Title>{title}</Card.Title>
						<Card.Description>{description}</Card.Description>
					</Card.Header>

					<Form method="post" action={routes.verifyEmail.action.href()}>
						<Card.Footer>
							<input type="hidden" name="token" value={token} />

							<Button type="submit" color="brand" mix={[is("100%")]}>
								{submit}
							</Button>
						</Card.Footer>
					</Form>
				</Card>
			</main>
		);
	};
}
