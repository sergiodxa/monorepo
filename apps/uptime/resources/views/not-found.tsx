/**
 * Not-found view component for the uptime app. Renders the 404 page body — a
 * title, a short description, and a link back to the homepage — using the title
 * and description the not-found view model supplies through its handle props. It
 * exists as the presentational piece the default handler and every "unknown slug"
 * marketing/docs controller composes into the document layout when a request
 * doesn't resolve to real content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Empty } from "@pkg/r3-ui";
import { fg } from "@pkg/u/color";
import { flex, flexCol } from "@pkg/u/layout";
import { m, maxIs, minBs } from "@pkg/u/size";
import { hover } from "@pkg/u/state";
import { textDecoration } from "@pkg/u/typography";

import routes from "~/routes/web";

namespace NotFoundView {
	export interface Setup {
		title: string;
		description: string;
		/** Link text for the link back to the homepage. */
		goBackHomeLabel: string;
	}
}

/** Renders the 404 body using the `title`/`description`/`goBackHomeLabel` the caller supplies via `Setup`. */
export default function NotFoundView(handle: Handle<NotFoundView.Setup>) {
	return () => {
		let { title, description, goBackHomeLabel } = handle.props;

		return (
			<main mix={[flex(), flexCol(), minBs("100vh")]}>
				<Empty mix={[m("auto"), maxIs("480px")]}>
					<Empty.Title>{title}</Empty.Title>
					<Empty.Description>{description}</Empty.Description>
					<Empty.Action>
						<a
							href={routes.home.href()}
							mix={[fg("brand"), textDecoration("none"), hover(textDecoration("underline"))]}
						>
							{goBackHomeLabel}
						</a>
					</Empty.Action>
				</Empty>
			</main>
		);
	};
}
