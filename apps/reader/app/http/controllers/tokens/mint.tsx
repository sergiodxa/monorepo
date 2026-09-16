/**
 * Minting for `POST /settings/tokens`: signs one token for this reader, writes the row
 * describing it, and shows the value once.
 *
 * It renders rather than redirects, because the token is the one thing on this surface that
 * exists exactly once: a redirect would have to carry it in a URL, where it would land in a
 * browser's history, in a referrer and in every log between here and there.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { flex, gap, items, vstack } from "@sdxc/u/layout";
import { m, maxIs, p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Alert, Description, LinkButton, Text } from "@sdxc/ui";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import { chrome } from "~/app/http/controllers/chrome";
import { NAME_FIELD, SCOPE_FIELD, TOKEN_PARAM } from "~/app/http/controllers/tokens/section";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { mintAgentToken } from "~/app/mcp/token";
import { userStore } from "~/database/user-do";
import AppLayout, { PAGE_COLUMN } from "~/resources/layouts/app";
import routes from "~/routes/web";

/** The name and the scope, both defaulted so an absent field is refused by the store. */
const MintForm = f.object({
	[NAME_FIELD]: f.field(s.defaulted(s.string(), "")),
	[SCOPE_FIELD]: f.field(s.defaulted(s.string(), "read")),
});

/** POST /settings/tokens — signs a token, writes its row, and shows it once. */
export default createAction(routes.tokens.create, {
	middleware: [requireUser],
	async handler(ctx) {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let submitted = s.parse(MintForm, ctx.formData);

		/**
		 * Signed before the row is written, because the row is written from what the signing
		 * produced: the id the payload names, and a digest of the signature over it.
		 */
		let minted = await mintAgentToken(viewer.id);

		let written = await userStore(viewer.id).createAgentToken({
			id: minted.tokenId,
			name: submitted[NAME_FIELD] ?? "",
			scope: submitted[SCOPE_FIELD] ?? "read",
			hash: minted.hash,
		});

		if (!written.ok) {
			return redirect(`${routes.settings.href()}?${TOKEN_PARAM}=${written.reason}`, {
				status: redirect.Status.SeeOther,
			});
		}

		ctx.log.note("mcp.token", {
			tokenId: written.token.id,
			scope: written.token.scope,
			action: "minted",
		});

		return ctx.render(
			<AppLayout
				documentTitle={ctx.i18next.t("agent.minted.title")}
				heading={ctx.i18next.t("agent.minted.heading")}
				locale={ctx.locale}
				{...await chrome(ctx)}
			>
				<section mix={[vstack({ gap: 3 }), maxIs(PAGE_COLUMN)]}>
					<Description>{ctx.i18next.t("agent.minted.description")}</Description>

					<Alert color="warning">
						<Alert.Content>
							<Alert.Description>{ctx.i18next.t("agent.minted.once")}</Alert.Description>
						</Alert.Content>
					</Alert>

					{/**
					 * The value itself, selectable as one run of text. There is no copy button,
					 * because a button that copies needs script and the value has to be reachable
					 * without it.
					 */}
					<Text
						mix={[
							m(0),
							p(3),
							rounded("md"),
							bg("neutral.tint"),
							fg("neutral.emphasis"),
							text("sm"),
							weight("medium"),
							maxIs("100%"),
						]}
					>
						<code>{minted.token}</code>
					</Text>

					<div mix={[flex(), gap(2), items("center")]}>
						<LinkButton href={routes.settings.href()} color="neutral" variant="outline">
							{ctx.i18next.t("agent.minted.back")}
						</LinkButton>
					</div>
				</section>
			</AppLayout>,
		);
	},
});
