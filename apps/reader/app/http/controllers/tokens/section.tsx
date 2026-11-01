/**
 * The agent sections of the settings page: what the Model Context Protocol endpoint is, the
 * tokens this reader minted for it, and the two forms that mint and revoke one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Alert, Button, Input, LinkButton, Select, Text } from "@sdxc/ui";
import { SettingsSection } from "@sdxc/ui/app/settings-section";

import type { AppContext } from "~/app/initializers/router";
import type { UserStore } from "~/app/models/user-store";

import { exactDate, shortDate } from "~/app/http/controllers/timeline-entries";
import { AGENT_SCOPES } from "~/database/schema";
import { SETTINGS_ANCHORS, SettingsCode, SettingsNote } from "~/resources/components/settings-area";
import routes from "~/routes/web";

/** The query parameter the settings page reads the outcome of a token action out of. */
export const TOKEN_PARAM = "token";

/** The field a token's name is submitted under. */
export const NAME_FIELD = "name";

/** The field a token's scope is submitted under. */
export const SCOPE_FIELD = "scope";

/** The longest name the form accepts, matching what the token row will hold. */
const TOKEN_NAME_MAX = 80;

/** Ties the name box to the label naming it. */
const NAME_ID = "settings-token-name";

/** Ties the scope picker to its own label, beside the name. */
const SCOPE_ID = "settings-token-scope";

/** The anchor of the form that mints a token, which the agent page's button jumps to. */
export const NEW_TOKEN_ANCHOR = "new-token";

/**
 * The address an agent is pointed at, absolute because a client configured with a path
 * alone has no host to send it to.
 *
 * @param ctx - The request being answered, whose origin the address is on.
 */
export function agentEndpoint(ctx: AppContext): string {
	return new URL(routes.mcp.index.href(), ctx.url).toString();
}

/**
 * The copy and tone for the outcome a token action redirected with, or `null` for an
 * ordinary view of the page.
 *
 * @param ctx - The request's dictionary and the query it arrived with.
 */
function tokenNote(
	ctx: AppContext,
): { message: string; color: "success" | "warning" | "danger" } | null {
	let outcome = ctx.url.searchParams.get(TOKEN_PARAM);
	if (outcome === null) return null;

	if (outcome === "revoked") {
		return { message: ctx.intl.t("agent.tokens.revoked"), color: "success" };
	}

	if (outcome === "missing") {
		return { message: ctx.intl.t("agent.tokens.missing"), color: "warning" };
	}

	return { message: ctx.intl.t(`agent.tokens.refused.${outcome}`), color: "danger" };
}

/**
 * Whether a token still answers, which is what decides how its row reads.
 *
 * @param token - The token as the RPC boundary reported it.
 * @param now - Epoch milliseconds the row is drawn at.
 */
function isLive(token: UserStore.AgentToken, now: number): boolean {
	return token.revokedAt === null && token.expiresAt > now;
}

/**
 * What one token's row says about its state, which is the one sentence a reader decides to
 * revoke from.
 *
 * @param ctx - The request being answered, read for its dictionary and locale.
 * @param token - The token the row is drawn for.
 * @param now - Epoch milliseconds the row is drawn at.
 */
function stateOf(ctx: AppContext, token: UserStore.AgentToken, now: number): string {
	if (token.revokedAt !== null) {
		return ctx.intl.t("agent.tokens.state.revoked", {
			date: shortDate(token.revokedAt, ctx.locale, now),
		});
	}

	if (token.expiresAt <= now) {
		return ctx.intl.t("agent.tokens.state.expired", {
			date: shortDate(token.expiresAt, ctx.locale, now),
		});
	}

	if (token.lastUsedAt === null) return ctx.intl.t("agent.tokens.state.never");

	return ctx.intl.t("agent.tokens.state.used", {
		date: shortDate(token.lastUsedAt, ctx.locale, now),
	});
}

/**
 * The agent sections of the settings page: the tokens this reader holds, then the form that
 * mints another as a section of its own, since it saves explicitly and the list does not.
 *
 * A reader whose plan does not carry this is told so in a sentence rather than shown an
 * empty list, because the person reading it is the person who might pay for it.
 *
 * @param ctx - The request being answered, read for its dictionary and query.
 * @param tokens - Every token this reader minted, newest first.
 * @param entitled - Whether their plan answers an agent at all.
 */
export default function tokensSection(
	ctx: AppContext,
	tokens: UserStore.AgentToken[],
	entitled: boolean,
) {
	let now = Date.now();
	let note = tokenNote(ctx);

	return (
		<>
			<SettingsSection
				id={SETTINGS_ANCHORS.agents}
				title={ctx.intl.t("agent.legend")}
				description={ctx.intl.t("agent.description")}
				save="instant"
				labels={{ save: ctx.intl.t("agent.mint.submit") }}
			>
				{note && (
					<SettingsNote color={note.color}>
						<Alert.Description>{note.message}</Alert.Description>
					</SettingsNote>
				)}

				{!entitled && (
					<SettingsNote color="warning">
						<Alert.Description>{ctx.intl.t("agent.locked")}</Alert.Description>
					</SettingsNote>
				)}

				{entitled && (
					<SettingsSection.Row layout="stacked" label={ctx.intl.t("agent.address")}>
						<div mix={[vstack({ gap: 2, align: "start" })]}>
							<SettingsCode>{agentEndpoint(ctx)}</SettingsCode>
							<LinkButton
								href={routes.mcp.index.href()}
								color="neutral"
								variant="outline"
								size="sm"
							>
								{ctx.intl.t("agent.connect")}
							</LinkButton>
						</div>
					</SettingsSection.Row>
				)}

				{tokens.length === 0 ? (
					<div mix={[p(4)]}>
						<Text mix={[text("sm"), fg("neutral.muted")]}>{ctx.intl.t("agent.tokens.none")}</Text>
					</div>
				) : (
					tokens.map((token) => (
						<SettingsSection.Row
							key={token.id}
							layout="inline-switch"
							label={token.name}
							description={[
								ctx.intl.t(`agent.scopes.${token.scope}`),
								stateOf(ctx, token, now),
								ctx.intl.t("agent.tokens.expires", {
									date: exactDate(token.expiresAt, ctx.locale),
								}),
							].join(" · ")}
						>
							{isLive(token, now) && (
								/**
								 * A method override rather than a `DELETE` a form cannot send, which is how
								 * every other revocation on this app's surface reaches its route.
								 */
								<form method="post" action={routes.tokens.revoke.href({ tokenId: token.id })}>
									<input type="hidden" name="_method" value="DELETE" />

									<Button type="submit" size="sm" color="neutral" variant="outline">
										{ctx.intl.t("agent.tokens.revoke")}
									</Button>
								</form>
							)}
						</SettingsSection.Row>
					))
				)}
			</SettingsSection>

			{entitled && (
				<SettingsSection
					id={NEW_TOKEN_ANCHOR}
					title={ctx.intl.t("agent.mint.legend")}
					save="explicit"
					form={{ action: routes.tokens.create.href() }}
					labels={{ save: ctx.intl.t("agent.mint.submit") }}
				>
					<SettingsSection.Row label={ctx.intl.t("agent.mint.name")} htmlFor={NAME_ID}>
						<Input
							id={NAME_ID}
							name={NAME_FIELD}
							required
							maxLength={TOKEN_NAME_MAX}
							placeholder={ctx.intl.t("agent.mint.placeholder")}
						/>
					</SettingsSection.Row>

					<SettingsSection.Row
						label={ctx.intl.t("agent.mint.scope")}
						description={ctx.intl.t("agent.mint.scopeHint")}
						htmlFor={SCOPE_ID}
					>
						<Select id={SCOPE_ID} name={SCOPE_FIELD}>
							{AGENT_SCOPES.map((scope) => (
								<Select.Option key={scope} value={scope} selected={scope === "read"}>
									{ctx.intl.t(`agent.scopes.${scope}`)}
								</Select.Option>
							))}
						</Select>
					</SettingsSection.Row>
				</SettingsSection>
			)}
		</>
	);
}
