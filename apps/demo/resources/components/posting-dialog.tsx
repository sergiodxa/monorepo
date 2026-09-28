/**
 * One position, as a summary row and the modal it opens. The dialog is native: the row's
 * button names it with `commandfor` and asks for `show-modal`, so the whole interaction is
 * HTML the browser already implements and the page ships no script at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { I18n } from "@sdxc/i18n";
import type { Handle } from "remix/ui";

import { Markdown } from "@sdxc/markdown";
import { toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";
import { hstack, vstack } from "@sdxc/u/layout";
import { is, maxIs, p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";

import type { Posting } from "~/database/schema";

namespace PostingDialog {
	export interface Props {
		/** The position to show. */
		posting: Posting;
		/** Translator for the language this page is rendered in. */
		intl: I18n;
	}
}

/** Renders the description as UI nodes, falling back to the source when it will not parse. */
function Description(handle: Handle<{ source: string }>) {
	return () => {
		let parsed = Markdown.parse(handle.props.source);
		if (isFailure(parsed)) return <p>{handle.props.source}</p>;
		return <div mix={[vstack({ gap: 3 })]}>{toRemix(parsed.data.document)}</div>;
	};
}

/** Renders the summary row and the modal it opens. */
export default function PostingDialog(handle: Handle<PostingDialog.Props>) {
	return () => {
		let { intl, posting } = handle.props;
		let dialogId = `posting-${posting.id}`;

		return (
			<li mix={[vstack({ gap: 2 }), p(4)]}>
				<h2 mix={[text("lg"), weight("medium")]}>{posting.title}</h2>
				<p mix={[text("sm")]}>
					{posting.company} — {posting.location} — {posting.salary}
				</p>
				<button type="button" commandfor={dialogId} command="show-modal">
					{intl.t("posting.open")}
				</button>

				<dialog id={dialogId} mix={[is("100%"), maxIs("40rem"), p(6)]}>
					<article mix={[vstack({ gap: 4 })]}>
						<h3 mix={[text("xl"), weight("medium")]}>{posting.title}</h3>
						<p mix={[text("sm")]}>
							{posting.company} — {posting.location} — {posting.salary}
						</p>

						<Description source={posting.description} />

						<div mix={[hstack({ gap: 3 })]}>
							<a href={`mailto:${posting.contact_email}`}>{intl.t("posting.contact")}</a>
							<button type="button" commandfor={dialogId} command="close">
								{intl.t("posting.close")}
							</button>
						</div>
					</article>
				</dialog>
			</li>
		);
	};
}
