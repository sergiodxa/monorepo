/**
 * A single centered card that states an outcome and offers at most one way onward. It
 * carries the three ends of the password-recovery flow — the link has been sent, the link
 * is no longer usable, the password has been changed — because they differ only in copy and
 * three near-identical pages would drift apart.
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

namespace PasswordNoticeView {
	export interface Props {
		/** Card heading, which is the outcome in one line. */
		title: string;
		/** The explanation under it, already translated. */
		description: string;
		/**
		 * The single way onward, when there is one. A page reporting an outcome nobody has to
		 * act on — a link is on its way — offers none rather than inviting a second attempt
		 * the cooldown would refuse.
		 */
		action: { label: string; href: string } | null;
	}
}

/** Renders the outcome card for one end of the password-recovery flow. */
export default function PasswordNoticeView(handle: Handle<PasswordNoticeView.Props>) {
	return () => {
		let { title, description, action } = handle.props;

		return (
			<main mix={[flex(), flexCol(), items("center"), justify("center"), minBs("100dvh"), p(6)]}>
				<Card mix={[is("100%"), maxIs("22.5rem")]}>
					<Card.Header mix={[textAlign("center")]}>
						<Card.Title>{title}</Card.Title>
					</Card.Header>

					<Card.Content mix={[textAlign("center")]}>
						<Text mix={[fg("neutral.muted")]}>{description}</Text>
					</Card.Content>

					{action && (
						<Card.Footer mix={[flex(), justify("center")]}>
							<LinkButton href={action.href} color="brand">
								{action.label}
							</LinkButton>
						</Card.Footer>
					)}
				</Card>
			</main>
		);
	};
}
