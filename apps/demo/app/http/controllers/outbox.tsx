/**
 * The outbox: every message the board has mailed, newest first. The app sends through a
 * transport that keeps messages in memory, so this page is where a confirmation actually
 * arrives — it is the board's inbox as much as its record of what was sent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { createAction } from "remix/router";

import { outbox } from "~/app/lib/mailer";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** GET /outbox — what the board has mailed so far. */
export default createAction(routes.outbox, (ctx) => {
	let messages = [...outbox.messages].reverse();

	return ctx.render(
		<DocumentLayout title={ctx.intl.t("outbox.title")} locale={ctx.locale}>
			<div mix={[vstack({ gap: 6 })]}>
				<header mix={[vstack({ gap: 2 })]}>
					<h1 mix={[text("3xl"), weight("light")]}>{ctx.intl.t("outbox.title")}</h1>
					<p>{ctx.intl.t("outbox.tagline")}</p>
					<a href={routes.board.index.href()}>{ctx.intl.t("outbox.back")}</a>
				</header>

				{messages.length === 0 ? (
					<p>{ctx.intl.t("outbox.empty")}</p>
				) : (
					<ul mix={[vstack({ gap: 4 })]}>
						{messages.map((message) => (
							<li key={message.messageId} mix={[vstack({ gap: 2 }), p(4)]}>
								<p mix={[text("sm")]}>
									{ctx.intl.t("outbox.to")}: {message.to.map((address) => address.email).join(", ")}
								</p>
								<h2 mix={[text("lg"), weight("medium")]}>{message.subject}</h2>
								<pre mix={[text("sm")]}>{message.text}</pre>
							</li>
						))}
					</ul>
				)}
			</div>
		</DocumentLayout>,
	);
});
