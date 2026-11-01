/**
 * Minting for `POST /settings/tokens`: signs one token for this reader, writes the row
 * describing it, and shows the value once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { fg } from "@sdxc/u/color";
import { flex, gap, items, vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Alert, Description, LinkButton } from "@sdxc/ui";
import { SettingsLayout } from "@sdxc/ui/app/settings-layout";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import { chrome } from "~/app/http/controllers/chrome";
import {
	agentEndpoint,
	NAME_FIELD,
	SCOPE_FIELD,
	TOKEN_PARAM,
} from "~/app/http/controllers/tokens/section";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { mintAgentToken } from "~/app/mcp/token";
import { userStore } from "~/app/models/user-store";
import { SettingsCode, SettingsPhoneNav, settingsNav } from "~/resources/components/settings-area";
import AppLayout from "~/resources/layouts/app";
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

		let store = userStore(viewer.id);
		let written = await store.createAgentToken({
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

		let entitlement = await store.entitlement();
		let nav = settingsNav(ctx.intl, "agents", { filters: entitlement.can.rules.apply });

		return ctx.render(
			<AppLayout
				assets={ctx.assets}
				documentTitle={ctx.intl.t("agent.minted.title")}
				heading={ctx.intl.t("agent.minted.heading")}
				locale={ctx.locale}
				{...await chrome(ctx)}
			>
				<SettingsLayout sections={nav.sections} labels={nav.labels} page="section">
					<SettingsPhoneNav
						sections={nav.sections}
						label={nav.labels.nav}
						jump={ctx.intl.t("settings.nav.jump")}
					/>

					<section mix={[vstack({ gap: 4, align: "stretch" })]}>
						<Description>{ctx.intl.t("agent.minted.description")}</Description>

						<Alert color="warning">
							<Alert.Content>
								<Alert.Description>{ctx.intl.t("agent.minted.once")}</Alert.Description>
							</Alert.Content>
						</Alert>

						{/**
						 * The value itself, selected whole by one click. There is no copy button,
						 * because a button that copies needs script and the value has to be reachable
						 * without it. The address sits under it, since a client needs both.
						 */}
						<div mix={[vstack({ gap: 1.5, align: "stretch" })]}>
							<h2 mix={[m(0), text("sm"), weight("medium"), fg("neutral.emphasis")]}>
								{ctx.intl.t("agent.minted.token")}
							</h2>
							<SettingsCode>{minted.token}</SettingsCode>
						</div>

						<div mix={[vstack({ gap: 1.5, align: "stretch" })]}>
							<h2 mix={[m(0), text("sm"), weight("medium"), fg("neutral.emphasis")]}>
								{ctx.intl.t("agent.address")}
							</h2>
							<SettingsCode>{agentEndpoint(ctx)}</SettingsCode>
						</div>

						<div mix={[flex(), gap(2), items("center")]}>
							<LinkButton href={routes.settings.href()} color="neutral" variant="outline">
								{ctx.intl.t("agent.minted.back")}
							</LinkButton>
						</div>
					</section>
				</SettingsLayout>
			</AppLayout>,
		);
	},
});
