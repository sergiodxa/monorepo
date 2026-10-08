/**
 * One position in the listing: the summary card and the modal it opens. The card carries
 * what the listing already holds — title, company, the two chips — and the modal's body is
 * left empty, so rendering the board costs nothing per posting beyond the row itself.
 *
 * The control is a link to the position's own page. The dialog is native, and the island
 * inside it turns that link into the button that opens it once there is script to do so.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { I18n } from "@sdxc/i18n";
import type { Handle } from "remix/component";

import { LazyFrame } from "@sdxc/lazy-frame/ui";
import { vstack } from "@sdxc/u/layout";
import { fontSize } from "@sdxc/u/typography";
import { Button, Card, Dialog, LinkButton } from "@sdxc/ui";

import type { Posting } from "~/database/schema";

import { PositionFacts } from "~/resources/components/position-detail";
import { frameHref } from "~/routes/frames";
import routes from "~/routes/web";

namespace PostingDialog {
	export interface Props {
		/** The position to summarize. */
		posting: Posting;
		/** Translator for the language this page is rendered in. */
		intl: I18n;
	}
}

/** Renders the listing card and the modal its control opens. */
export default function PostingDialog(handle: Handle<PostingDialog.Props>) {
	return () => {
		let { intl, posting } = handle.props;

		let dialogId = `posting-${posting.id}`;
		let titleId = `${dialogId}-title`;
		let triggerId = `${dialogId}-trigger`;
		let href = routes.position.href({ id: posting.id });

		return (
			<li>
				<Card>
					<Card.Header>
						<Card.Title mix={[fontSize("lg")]}>{posting.title}</Card.Title>
						<Card.Description>{posting.company}</Card.Description>
					</Card.Header>
					<Card.Content>
						<PositionFacts posting={posting} />
					</Card.Content>
					<Card.Footer>
						<LinkButton id={triggerId} href={href} variant="outline" color="brand" size="sm">
							{intl.t("posting.open")}
						</LinkButton>
					</Card.Footer>
				</Card>

				<Dialog id={dialogId} aria-labelledby={titleId}>
					<Dialog.Header>
						<Dialog.Title id={titleId}>{posting.title}</Dialog.Title>
						<Dialog.Description>{posting.company}</Dialog.Description>
					</Dialog.Header>

					<div mix={[vstack({ gap: 4 })]}>
						<LazyFrame
							src={frameHref(href)}
							loadOn="open"
							opener={triggerId}
							fallback={intl.t("posting.loading")}
						>
							<a href={href}>{intl.t("posting.read")}</a>
						</LazyFrame>
					</div>

					<Dialog.Footer>
						<Button commandfor={dialogId} command="close" variant="outline" color="neutral">
							{intl.t("posting.close")}
						</Button>
					</Dialog.Footer>

					<Dialog.Close commandfor={dialogId} aria-label={intl.t("posting.close")} />
				</Dialog>
			</li>
		);
	};
}
