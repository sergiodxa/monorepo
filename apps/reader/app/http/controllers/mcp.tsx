/**
 * The page at `GET /mcp`, explaining what answers a `POST` to the same address: what the
 * server offers, what a token is, and what a client has to be able to do to connect.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { borderEdge, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { m, pbs } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Description, LinkButton } from "@sdxc/ui";
import { SettingsLayout } from "@sdxc/ui/app/settings-layout";
import { createAction } from "remix/router";

import { chrome } from "~/app/http/controllers/chrome";
import { agentEndpoint, NEW_TOKEN_ANCHOR } from "~/app/http/controllers/tokens/section";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/app/models/user-store";
import { SettingsCode, SettingsPhoneNav, settingsNav } from "~/resources/components/settings-area";
import AppLayout from "~/resources/layouts/app";
import routes from "~/routes/web";

/** The three things the page says about connecting, each one sentence in the dictionary. */
const STEPS = ["mint", "configure", "ask"] as const;

/** GET /mcp — what answers an agent at this address, and how to point one at it. */
export default createAction(routes.mcp.index, {
	middleware: [requireUser],
	async handler(ctx) {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let entitlement = await userStore(viewer.id).entitlement();
		let nav = settingsNav(ctx.intl, "agents", { filters: entitlement.can.rules.apply });

		return ctx.render(
			<AppLayout
				assets={ctx.assets}
				documentTitle={ctx.intl.t("agent.page.title")}
				heading={ctx.intl.t("agent.page.heading")}
				locale={ctx.locale}
				{...await chrome(ctx)}
			>
				<SettingsLayout sections={nav.sections} labels={nav.labels} page="section">
					<SettingsPhoneNav
						sections={nav.sections}
						label={nav.labels.nav}
						jump={ctx.intl.t("settings.nav.jump")}
					/>

					<section mix={[vstack({ gap: 3, align: "stretch" })]}>
						<Description>{ctx.intl.t("agent.page.description")}</Description>

						<SettingsCode>{agentEndpoint(ctx)}</SettingsCode>

						<ol
							mix={[
								m(0),
								vstack({ gap: 2 }),
								raw({ listStyleType: "decimal", paddingInlineStart: "1.25rem" }),
							]}
						>
							{STEPS.map((step) => (
								<li key={step} mix={[text("sm"), fg("neutral")]}>
									{ctx.intl.t(`agent.page.steps.${step}`)}
								</li>
							))}
						</ol>
					</section>

					{/**
					 * The limit stated where somebody meets it, rather than discovered as a hang: a
					 * client that can only start an OAuth flow finds nothing here to start one with.
					 */}
					<section
						mix={[
							vstack({ gap: 3, align: "stretch" }),
							pbs(6),
							borderEdge("block-start", { color: "neutral.border", width: 1 }),
						]}
					>
						{/** Level 2, since the layout's own page heading is the document's only `h1`. */}
						<h2 mix={[m(0), text("sm"), weight("medium"), fg("neutral.emphasis")]}>
							{ctx.intl.t("agent.page.clients.legend")}
						</h2>

						<Description>{ctx.intl.t("agent.page.clients.description")}</Description>

						<div>
							<LinkButton
								href={`${routes.settings.href()}#${NEW_TOKEN_ANCHOR}`}
								color="neutral"
								variant="outline"
							>
								{ctx.intl.t("agent.page.clients.tokens")}
							</LinkButton>
						</div>
					</section>
				</SettingsLayout>
			</AppLayout>,
		);
	},
});
