/**
 * The `/u/error` screen: a terminal protocol failure with a correlation id a
 * support conversation can reference. Rendered inline rather than redirected to,
 * since a `render`-class failure means there is nowhere trustworthy yet to send
 * the browser back to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";
import type { Handle } from "remix/ui";

import { vstack } from "@sdxc/u/layout";
import { is, maxIs } from "@sdxc/u/size";
import { Card, Text } from "@sdxc/ui";

export namespace ErrorPage {
	export interface Props {
		t: TFunction;
		/** The already-composed, developer-facing sentence the failing operation answered with. */
		description: string;
		correlationId: string;
	}
}

/**
 * Renders a terminal protocol failure.
 *
 * @param handle - Component handle exposing the screen's props.
 * @returns A render function producing the error screen's markup.
 */
export function ErrorPage(handle: Handle<ErrorPage.Props>) {
	return () => {
		let { t, description, correlationId } = handle.props;

		return (
			<Card mix={[is("100%"), maxIs("24rem")]}>
				<Card.Header>
					<Card.Title>{t("hostedError.title")}</Card.Title>
				</Card.Header>

				<Card.Content mix={[vstack({ gap: 2 })]}>
					<Text>{description}</Text>
					<Text>{t("hostedError.backHint")}</Text>
					<Text>{t("hostedError.correlationId", { id: correlationId })}</Text>
				</Card.Content>
			</Card>
		);
	};
}
