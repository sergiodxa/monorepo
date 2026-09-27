/**
 * Unsubscribe controller for `/notifications/unsubscribe/:token`, the link a notification email
 * carries. It answers without a session, since the link alone names the reader: `GET` asks,
 * and `POST` turns the email channel off for a person or a mailbox provider's one-click request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { isOneClickUnsubscribe } from "@sdxc/mail/unsubscribe";
import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { maxIs, mi, minBs, p } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { textAlign, textDecoration } from "@sdxc/u/typography";
import { Button, Heading, Text } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { createController } from "remix/router";

import { unsubscribingReader } from "~/app/push/unsubscribe";
import { userStore } from "~/database/user-do";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The path this route matches: the signed token and nothing else. */
const Params = s.object({ token: s.string() });

/** The centered column every state of this page is drawn in, below its heading and copy. */
function UnsubscribePage(
	handle: Handle<{ title: string; description: string; locale: string; children?: RemixNode }>,
) {
	return () => {
		let { title, description, locale, children } = handle.props;

		return (
			<DocumentLayout title={title} locale={locale}>
				<main
					mix={[
						vstack({ gap: 6, align: "center", justify: "center" }),
						minBs("100dvh"),
						maxIs("36rem"),
						mi("auto"),
						p(8),
						textAlign("center"),
					]}
				>
					<Heading level={1}>{title}</Heading>
					<Text mix={[fg("neutral.muted")]}>{description}</Text>
					{children}
				</main>
			</DocumentLayout>
		);
	};
}

/** The link to the settings page, where every channel can be turned back on or off. */
function SettingsLink(handle: Handle<{ label: string }>) {
	return () => (
		<a
			href={routes.settings.href()}
			mix={[fg("brand"), textDecoration("none"), hover(textDecoration("underline"))]}
		>
			{handle.props.label}
		</a>
	);
}

export default createController(routes.unsubscribe, {
	actions: {
		/**
		 * GET /notifications/unsubscribe/:token — the confirmation. It changes nothing, because
		 * a mail scanner follows every link it sees; a link this app did not sign answers `404`.
		 */
		async index(ctx) {
			let { token } = s.parse(Params, ctx.params);
			let t = ctx.intl.t;

			if ((await unsubscribingReader(token)) === null) {
				return ctx.render(
					<UnsubscribePage
						title={t("unsubscribe.invalidTitle")}
						description={t("unsubscribe.invalidDescription")}
						locale={ctx.locale}
					>
						<SettingsLink label={t("unsubscribe.settings")} />
					</UnsubscribePage>,
					{ status: 404 },
				);
			}

			return ctx.render(
				<UnsubscribePage
					title={t("unsubscribe.title")}
					description={t("unsubscribe.description")}
					locale={ctx.locale}
				>
					<form
						method="post"
						action={routes.unsubscribe.action.href({ token })}
						data-rmx-document=""
					>
						<Button type="submit">{t("unsubscribe.cta")}</Button>
					</form>
				</UnsubscribePage>,
			);
		},

		/**
		 * POST /notifications/unsubscribe/:token — turns the email channel off. A mailbox
		 * provider's RFC 8058 request reads no body, so it gets an empty `200` whatever the
		 * token was; a person gets the page saying what happened.
		 */
		async action(ctx) {
			let { token } = s.parse(Params, ctx.params);
			let subject = await unsubscribingReader(token);

			if (subject !== null) await userStore(subject).stopEmail();

			if (isOneClickUnsubscribe(ctx.formData)) return new Response(null, { status: 200 });

			let t = ctx.intl.t;

			if (subject === null) {
				return ctx.render(
					<UnsubscribePage
						title={t("unsubscribe.invalidTitle")}
						description={t("unsubscribe.invalidDescription")}
						locale={ctx.locale}
					>
						<SettingsLink label={t("unsubscribe.settings")} />
					</UnsubscribePage>,
					{ status: 404 },
				);
			}

			return ctx.render(
				<UnsubscribePage
					title={t("unsubscribe.doneTitle")}
					description={t("unsubscribe.doneDescription")}
					locale={ctx.locale}
				>
					<SettingsLink label={t("unsubscribe.settings")} />
				</UnsubscribePage>,
			);
		},
	},
});
