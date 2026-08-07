/**
 * The page a verification link lands on: a centered card carrying the outcome's heading
 * and sentence, and — when there is somewhere useful to go — one link.
 *
 * It is a standalone document rather than an account page because the reader arrives from
 * an inbox and may hold no session at all, so nothing here may assume a signed-in chrome
 * to sit inside.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Card, LinkButton, Text } from "@pkg/r3-ui";
import { fg } from "@pkg/u/color";
import { flex, flexCol, items, justify } from "@pkg/u/layout";
import { is, maxIs, minBs, p } from "@pkg/u/size";
import { textAlign } from "@pkg/u/typography";

namespace VerifyEmailView {
	export interface Props {
		/** Heading naming the outcome. */
		title: string;
		/** The sentence explaining it, and what to do next when anything can be done. */
		description: string;
		/** The one onward link, or `null` when the outcome offers none. */
		action: { label: string; href: string } | null;
	}
}

/** Renders the outcome of following a verification link. */
export default function VerifyEmailView(handle: Handle<VerifyEmailView.Props>) {
	return () => {
		let { title, description, action } = handle.props;

		return (
			<main mix={[flex(), flexCol(), items("center"), justify("center"), minBs("100dvh"), p(6)]}>
				<Card mix={[is("100%"), maxIs("26rem")]}>
					<Card.Header mix={[textAlign("center")]}>
						<Card.Title>{title}</Card.Title>
					</Card.Header>

					<Card.Content mix={[textAlign("center")]}>
						<Text mix={[fg("neutral.muted")]}>{description}</Text>
					</Card.Content>

					{action ? (
						<Card.Footer mix={[justify("center")]}>
							<LinkButton href={action.href} color="brand">
								{action.label}
							</LinkButton>
						</Card.Footer>
					) : null}
				</Card>
			</main>
		);
	};
}
