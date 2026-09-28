/**
 * The board itself: the header, the open positions, and the modal that publishes a new one.
 * Every position renders its own dialog beside its row, so opening one is a button naming
 * an element on the page the visitor already has.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { I18n } from "@sdxc/i18n";
import type { Handle } from "remix/ui";

import { hstack, vstack } from "@sdxc/u/layout";
import { text, weight } from "@sdxc/u/typography";

import type { Posting } from "~/database/schema";

import PostForm, { POST_FORM_DIALOG_ID } from "~/resources/components/post-form";
import PostingDialog from "~/resources/components/posting-dialog";
import routes from "~/routes/web";

namespace BoardView {
	export interface Props {
		/** Translator for the language this page is rendered in. */
		intl: I18n;
		/** The open positions, newest first. */
		postings: Posting[];
		/** Turnstile site key, or `null` when the board runs on the local challenge. */
		siteKey: string | null;
		/** Why the last submission was refused; its presence also reopens the form. */
		error?: string;
	}
}

/** Renders the board page. */
export default function BoardView(handle: Handle<BoardView.Props>) {
	return () => {
		let { error, intl, postings, siteKey } = handle.props;

		return (
			<div mix={[vstack({ gap: 6 })]}>
				<header mix={[vstack({ gap: 2 })]}>
					<h1 mix={[text("3xl"), weight("light")]}>{intl.t("board.title")}</h1>
					<p>{intl.t("board.tagline")}</p>
					<div mix={[hstack({ gap: 3 })]}>
						<button type="button" commandfor={POST_FORM_DIALOG_ID} command="show-modal">
							{intl.t("board.post")}
						</button>
						<a href={routes.outbox.href()}>{intl.t("board.outbox")}</a>
					</div>
				</header>

				{postings.length === 0 ? (
					<p>{intl.t("board.empty")}</p>
				) : (
					<ul mix={[vstack({ gap: 4 })]}>
						{postings.map((posting) => (
							<PostingDialog key={posting.id} posting={posting} intl={intl} />
						))}
					</ul>
				)}

				<PostForm intl={intl} siteKey={siteKey} error={error} />
			</div>
		);
	};
}
