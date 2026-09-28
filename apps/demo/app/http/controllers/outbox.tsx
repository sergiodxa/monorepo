/**
 * The outbox: every message the board has mailed, newest first. The app sends through a
 * transport that keeps messages in memory, so this page is where a confirmation actually
 * arrives — it is the board's inbox as much as its record of what was sent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { font, fontSize, whiteSpace } from "@sdxc/u/typography";
import { Card, Empty, Heading, HeadingScope, LinkButton, Separator, Text } from "@sdxc/ui";
import { createAction } from "remix/router";

import { outbox } from "~/app/lib/mailer";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** GET /outbox — what the board has mailed so far. */
export default createAction(routes.outbox, (ctx) => {
	let messages = [...outbox.messages].reverse();

	return ctx.render(
		<DocumentLayout title={ctx.intl.t("outbox.title")} locale={ctx.locale}>
			<div mix={[vstack({ gap: 8 })]}>
				<header mix={[vstack({ gap: 4 })]}>
					<div mix={[vstack({ gap: 2 })]}>
						<Heading level={1} mix={[fontSize("3xl")]}>
							{ctx.intl.t("outbox.title")}
						</Heading>
						<Text mix={[fontSize("base")]}>{ctx.intl.t("outbox.tagline")}</Text>
					</div>
					<div>
						<LinkButton href={routes.board.index.href()} variant="outline" color="neutral">
							{ctx.intl.t("outbox.back")}
						</LinkButton>
					</div>
				</header>

				<Separator />

				<HeadingScope level={2}>
					{messages.length === 0 ? (
						<Empty>
							<Empty.Title>{ctx.intl.t("outbox.emptyTitle")}</Empty.Title>
							<Empty.Description>{ctx.intl.t("outbox.empty")}</Empty.Description>
						</Empty>
					) : (
						<ul mix={[vstack({ gap: 4 })]}>
							{messages.map((message) => (
								<li key={message.messageId}>
									<Card>
										<Card.Header>
											<Card.Description>
												{ctx.intl.t("outbox.to")}:{" "}
												{message.to.map((address) => address.email).join(", ")}
											</Card.Description>
											<Card.Title mix={[fontSize("lg")]}>{message.subject}</Card.Title>
										</Card.Header>
										<Card.Content mix={[font("mono"), fontSize("sm"), whiteSpace("pre-wrap")]}>
											{message.text}
										</Card.Content>
									</Card>
								</li>
							))}
						</ul>
					)}
				</HeadingScope>
			</div>
		</DocumentLayout>,
	);
});
