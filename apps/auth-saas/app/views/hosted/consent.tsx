/**
 * The `/u/consent` screen: the client, who is signed in, and every requested scope
 * with which are already granted, and a submit for each of the two decisions a
 * person can take.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";
import type { Handle } from "remix/ui";

import { flex, gap, items, justify, vstack } from "@sdxc/u/layout";
import { is, maxIs } from "@sdxc/u/size";
import { Badge, Button, Card, Text } from "@sdxc/ui";
import { css } from "remix/ui";

import type { ConsentScreen } from "~/database/consent";

export namespace ConsentPage {
	export interface Props {
		t: TFunction;
		/** Where both decisions post back to, carrying the interaction id in its query. */
		action: string;
		screen: ConsentScreen;
	}
}

/**
 * Renders the consent screen for a pending authorization request.
 *
 * @param handle - Component handle exposing the screen's props.
 * @returns A render function producing the consent screen's markup.
 */
export function ConsentPage(handle: Handle<ConsentPage.Props>) {
	return () => {
		let { t, action, screen } = handle.props;

		return (
			<Card mix={[is("100%"), maxIs("26rem")]}>
				<Card.Header>
					<Card.Title>{t("hostedConsent.title", { clientName: screen.client.name })}</Card.Title>
					<Card.Description>
						{t("hostedConsent.signedInAs", { name: screen.subject.displayName })}
					</Card.Description>
				</Card.Header>

				<Card.Content mix={[vstack({ gap: 3 })]}>
					<Text>{t("hostedConsent.scopesHeading", { clientName: screen.client.name })}</Text>

					<ul mix={[vstack({ gap: 2 }), css({ listStyle: "none", padding: "0", margin: "0" })]}>
						{screen.requested.map((scope) => (
							<li key={scope.scope} mix={[flex(), items("center"), justify("between"), gap(2)]}>
								<Text>{scope.title}</Text>
								{scope.granted && (
									<Badge color="neutral">{t("hostedConsent.alreadyGranted")}</Badge>
								)}
							</li>
						))}
					</ul>
				</Card.Content>

				<Card.Footer mix={[flex(), gap(3)]}>
					<form method="post" action={action} mix={[flex(), gap(3), is("100%")]}>
						<Button type="submit" name="decision" value="deny" color="neutral" mix={[is("100%")]}>
							{t("hostedConsent.deny")}
						</Button>
						<Button type="submit" name="decision" value="approve" color="brand" mix={[is("100%")]}>
							{t("hostedConsent.approve")}
						</Button>
					</form>
				</Card.Footer>
			</Card>
		);
	};
}
