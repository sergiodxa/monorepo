/**
 * One position's detail: the chips, the description its author wrote, and the way to apply.
 * It draws a document somebody else parsed, so the markup a page shows and the parser that
 * produced it stay on opposite sides of the call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { I18n } from "@sdxc/i18n";
import type { Markdown } from "@sdxc/markdown";
import type { Handle } from "remix/component";

import { toRemix } from "@sdxc/markdown/remix";
import { flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { Badge, LinkButton, Typeset } from "@sdxc/ui";

import type { Posting } from "~/database/schema";

/**
 * The location and salary chips. The listing repeats them from the row it already holds, so
 * a visitor reads the same two facts before and after the detail arrives.
 */
export function PositionFacts(handle: Handle<{ posting: Posting }>) {
	return () => {
		let { posting } = handle.props;

		return (
			<div mix={[hstack({ gap: 2 }), flexWrap()]}>
				<Badge variant="secondary" color="neutral">
					{posting.location}
				</Badge>
				<Badge variant="outline" color="brand">
					{posting.salary}
				</Badge>
			</div>
		);
	};
}

namespace PositionDetail {
	export interface Props {
		/** The position being read. */
		posting: Posting;
		/** Translator for the language this page is rendered in. */
		intl: I18n;
		/**
		 * The description as a parsed document, or `null` when it would not parse, in which
		 * case the source the author wrote is shown as it stands.
		 */
		description: Markdown.Node | null;
	}
}

/**
 * Renders everything a visitor came for: the chips, the body, and the contact. The same
 * nodes answer the position's own page and the fragment a dialog's frame is filled with, so
 * the two can never drift apart.
 */
export default function PositionDetail(handle: Handle<PositionDetail.Props>) {
	return () => {
		let { description, intl, posting } = handle.props;

		return (
			<div mix={[vstack({ gap: 4 })]}>
				<PositionFacts posting={posting} />
				<Typeset preset="reading">
					{description === null ? <p>{posting.description}</p> : toRemix(description)}
				</Typeset>
				<div mix={[hstack({ gap: 3 }), flexWrap()]}>
					<LinkButton href={`mailto:${posting.contact_email}`} color="brand">
						{intl.t("posting.contact")}
					</LinkButton>
				</div>
			</div>
		);
	};
}
