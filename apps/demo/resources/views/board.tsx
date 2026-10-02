/**
 * The board itself: the header, the open positions, and the modal that publishes a new one.
 * Every position renders its own dialog beside its card, so opening one is a button naming
 * an element on the page the visitor already has.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { I18n } from "@sdxc/i18n";
import type { Handle } from "remix/component";

import { flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { fontSize } from "@sdxc/u/typography";
import { Button, Empty, Heading, HeadingScope, LinkButton, Separator, Text } from "@sdxc/ui";

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
			<div mix={[vstack({ gap: 8 })]}>
				<header mix={[vstack({ gap: 4 })]}>
					<div mix={[vstack({ gap: 2 })]}>
						<Heading level={1} mix={[fontSize("3xl")]}>
							{intl.t("board.title")}
						</Heading>
						<Text mix={[fontSize("base")]}>{intl.t("board.tagline")}</Text>
					</div>
					<div mix={[hstack({ gap: 3 }), flexWrap()]}>
						<Button commandfor={POST_FORM_DIALOG_ID} command="show-modal" color="brand">
							{intl.t("board.post")}
						</Button>
						<LinkButton href={routes.outbox.href()} variant="outline" color="neutral">
							{intl.t("board.outbox")}
						</LinkButton>
					</div>
				</header>

				<Separator />

				<HeadingScope level={2}>
					{postings.length === 0 ? (
						<Empty>
							<Empty.Title>{intl.t("board.emptyTitle")}</Empty.Title>
							<Empty.Description>{intl.t("board.empty")}</Empty.Description>
							<Empty.Action>
								<Button commandfor={POST_FORM_DIALOG_ID} command="show-modal" color="brand">
									{intl.t("board.post")}
								</Button>
							</Empty.Action>
						</Empty>
					) : (
						<ul mix={[vstack({ gap: 4 })]}>
							{postings.map((posting) => (
								<PostingDialog key={posting.id} posting={posting} intl={intl} />
							))}
						</ul>
					)}
				</HeadingScope>

				<HeadingScope level={2}>
					<PostForm intl={intl} siteKey={siteKey} error={error} />
				</HeadingScope>
			</div>
		);
	};
}
