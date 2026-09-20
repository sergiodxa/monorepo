/**
 * The one-time recovery-codes reveal both `/u/second-factor` and `/u/step-up`
 * show right after an enrolment their own fallback form just activated —
 * `activateTotpFactor` returns the codes exactly once, so this is the only
 * screen that will ever show them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";
import type { Handle } from "remix/ui";

import { vstack } from "@sdxc/u/layout";
import { is, maxIs } from "@sdxc/u/size";
import { Button, Card, Text } from "@sdxc/ui";
import { css } from "remix/ui";

export namespace RecoveryCodesPage {
	export interface Props {
		t: TFunction;
		title: string;
		body: string;
		codes: string[];
		/** Where the continue form posts back to, carrying the interaction id in its query. */
		continueAction: string;
		continueLabel: string;
	}
}

/**
 * Renders the recovery-codes reveal, with a single continue button.
 *
 * @param handle - Component handle exposing the screen's props.
 * @returns A render function producing the reveal's markup.
 */
export function RecoveryCodesPage(handle: Handle<RecoveryCodesPage.Props>) {
	return () => {
		let { title, body, codes, continueAction, continueLabel } = handle.props;

		return (
			<Card mix={[is("100%"), maxIs("24rem")]}>
				<Card.Header>
					<Card.Title>{title}</Card.Title>
					<Card.Description>{body}</Card.Description>
				</Card.Header>

				<Card.Content mix={[vstack({ gap: 2 })]}>
					<ul mix={[vstack({ gap: 1 }), css({ listStyle: "none", padding: "0", margin: "0" })]}>
						{codes.map((code) => (
							<li key={code}>
								<Text mix={[css({ fontFamily: "monospace" })]}>{code}</Text>
							</li>
						))}
					</ul>

					<form method="post" action={continueAction}>
						<Button type="submit" color="brand" mix={[is("100%")]}>
							{continueLabel}
						</Button>
					</form>
				</Card.Content>
			</Card>
		);
	};
}
