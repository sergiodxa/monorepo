/**
 * One position, as a card in the listing and the modal it opens. The dialog is native: the
 * card's button names it with `commandfor` and asks for `show-modal`, so the whole
 * interaction is HTML the browser already implements and the page ships no script at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { I18n } from "@sdxc/i18n";
import type { Handle } from "remix/ui";

import { Markdown } from "@sdxc/markdown";
import { toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";
import { flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { fontSize } from "@sdxc/u/typography";
import { Badge, Button, Card, Dialog, LinkButton, Typeset } from "@sdxc/ui";

import type { Posting } from "~/database/schema";

/** Renders the description as UI nodes, falling back to the source when it will not parse. */
function Description(handle: Handle<{ source: string }>) {
	return () => {
		let parsed = Markdown.parse(handle.props.source);
		if (isFailure(parsed)) return <p>{handle.props.source}</p>;
		return <>{toRemix(parsed.data.document)}</>;
	};
}

/** The location and salary chips, which the card and the dialog both carry. */
function Facts(handle: Handle<{ posting: Posting }>) {
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

namespace PostingDialog {
	export interface Props {
		/** The position to show. */
		posting: Posting;
		/** Translator for the language this page is rendered in. */
		intl: I18n;
	}
}

/** Renders the listing card and the modal it opens. */
export default function PostingDialog(handle: Handle<PostingDialog.Props>) {
	return () => {
		let { intl, posting } = handle.props;
		let dialogId = `posting-${posting.id}`;
		let titleId = `${dialogId}-title`;

		return (
			<li>
				<Card>
					<Card.Header>
						<Card.Title mix={[fontSize("lg")]}>{posting.title}</Card.Title>
						<Card.Description>{posting.company}</Card.Description>
					</Card.Header>
					<Card.Content>
						<Facts posting={posting} />
					</Card.Content>
					<Card.Footer>
						<Button
							commandfor={dialogId}
							command="show-modal"
							variant="outline"
							color="brand"
							size="sm"
						>
							{intl.t("posting.open")}
						</Button>
					</Card.Footer>
				</Card>

				<Dialog id={dialogId} aria-labelledby={titleId}>
					<Dialog.Header>
						<Dialog.Title id={titleId}>{posting.title}</Dialog.Title>
						<Dialog.Description>{posting.company}</Dialog.Description>
					</Dialog.Header>

					<div mix={[vstack({ gap: 4 })]}>
						<Facts posting={posting} />
						<Typeset preset="reading">
							<Description source={posting.description} />
						</Typeset>
					</div>

					<Dialog.Footer>
						<Button commandfor={dialogId} command="close" variant="outline" color="neutral">
							{intl.t("posting.close")}
						</Button>
						<LinkButton href={`mailto:${posting.contact_email}`} color="brand">
							{intl.t("posting.contact")}
						</LinkButton>
					</Dialog.Footer>

					<Dialog.Close commandfor={dialogId} aria-label={intl.t("posting.close")} />
				</Dialog>
			</li>
		);
	};
}
