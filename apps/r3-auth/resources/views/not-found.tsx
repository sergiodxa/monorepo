/**
 * The 404 page for unmatched routes. A centered card carries the localized heading
 * and explanation, so a mistyped endpoint stays styled as part of this application.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@pkg/u/color";
import { flex, flexCol, items, justify } from "@pkg/u/layout";
import { is, maxIs, minBs, p } from "@pkg/u/size";
import { textAlign } from "@pkg/u/typography";
import { Card, Text } from "@pkg/ui";

import type { NotFoundViewModel } from "~/app/http/view-models/not-found";

namespace NotFoundView {
	export interface Setup extends NotFoundViewModel.DefaultOutput {}
}

/** Renders the 404 heading and explanation. */
export default function NotFoundView(handle: Handle<NotFoundView.Setup>) {
	return () => {
		let { title, description } = handle.props;

		return (
			<main mix={[flex(), flexCol(), items("center"), justify("center"), minBs("100dvh"), p(6)]}>
				<Card mix={[is("100%"), maxIs("22.5rem")]}>
					<Card.Header mix={[textAlign("center")]}>
						<Card.Title>{title}</Card.Title>
					</Card.Header>

					<Card.Content mix={[textAlign("center")]}>
						<Text mix={[fg("neutral.muted")]}>{description}</Text>
					</Card.Content>
				</Card>
			</main>
		);
	};
}
