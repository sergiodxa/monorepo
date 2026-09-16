/**
 * The agent section of the settings page: what the Model Context Protocol endpoint is, the
 * tokens this reader minted for it, and the two forms that mint and revoke one.
 *
 * It lives beside the controllers that act on a token rather than inside the settings page,
 * so the surface and the two routes acting on it are read together.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { borderEdge, fg } from "@sdxc/u/color";
import { flex, flexWrap, gap, items, vstack } from "@sdxc/u/layout";
import { m, maxIs, mbs, pbs } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Alert, Button, Description, Input, Label, Select, Text } from "@sdxc/ui";

import type { UserStore } from "~/database/user-do";

import { exactDate, shortDate } from "~/app/http/controllers/timeline-entries";
import { AGENT_SCOPES } from "~/database/schema";
import { PAGE_COLUMN } from "~/resources/layouts/app";
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

/**
 * The copy and tone for the outcome a token action redirected with, or `null` for an
 * ordinary view of the page.
 *
 * @param ctx - The request's dictionary and the query it arrived with.
 */
function tokenNote(
	ctx: RequestContext,
): { message: string; color: "success" | "warning" | "danger" } | null {
	let outcome = ctx.url.searchParams.get(TOKEN_PARAM);
	if (outcome === null) return null;

	if (outcome === "revoked") {
		return { message: ctx.i18next.t("agent.tokens.revoked"), color: "success" };
	}

	if (outcome === "missing") {
		return { message: ctx.i18next.t("agent.tokens.missing"), color: "warning" };
	}

	return { message: ctx.i18next.t(`agent.tokens.refused.${outcome}`), color: "danger" };
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
function stateOf(ctx: RequestContext, token: UserStore.AgentToken, now: number): string {
	if (token.revokedAt !== null) {
		return ctx.i18next.t("agent.tokens.state.revoked", {
			date: shortDate(token.revokedAt, ctx.locale, now),
		});
	}

	if (token.expiresAt <= now) {
		return ctx.i18next.t("agent.tokens.state.expired", {
			date: shortDate(token.expiresAt, ctx.locale, now),
		});
	}

	if (token.lastUsedAt === null) return ctx.i18next.t("agent.tokens.state.never");

	return ctx.i18next.t("agent.tokens.state.used", {
		date: shortDate(token.lastUsedAt, ctx.locale, now),
	});
}

/**
 * The agent section of the settings page.
 *
 * A reader whose plan does not carry this is told so in a sentence rather than shown an
 * empty list, because the person reading it is the person who might pay for it.
 *
 * @param ctx - The request being answered, read for its dictionary and query.
 * @param tokens - Every token this reader minted, newest first.
 * @param entitled - Whether their plan answers an agent at all.
 */
export default function tokensSection(
	ctx: RequestContext,
	tokens: UserStore.AgentToken[],
	entitled: boolean,
) {
	let now = Date.now();
	let note = tokenNote(ctx);

	return (
		<section
			mix={[
				vstack({ gap: 3 }),
				maxIs(PAGE_COLUMN),
				pbs(6),
				borderEdge("block-start", { color: "neutral.border", width: 1 }),
			]}
		>
			{/** Level 2, since the layout's own page heading is the document's only `h1`. */}
			<h2 mix={[m(0), text("sm"), weight("medium"), fg("neutral.emphasis")]}>
				{ctx.i18next.t("agent.legend")}
			</h2>

			<Description>{ctx.i18next.t("agent.description")}</Description>

			<Text mix={[text("xs"), fg("neutral.muted")]}>
				{ctx.i18next.t("agent.endpoint", { url: routes.mcp.index.href() })}
			</Text>

			{note && (
				<Alert color={note.color}>
					<Alert.Content>
						<Alert.Description>{note.message}</Alert.Description>
					</Alert.Content>
				</Alert>
			)}

			{!entitled && (
				<Alert color="warning">
					<Alert.Content>
						<Alert.Description>{ctx.i18next.t("agent.locked")}</Alert.Description>
					</Alert.Content>
				</Alert>
			)}

			{tokens.length === 0 ? (
				<Text mix={[text("xs"), fg("neutral.muted")]}>{ctx.i18next.t("agent.tokens.none")}</Text>
			) : (
				<ul mix={[m(0), vstack({ gap: 2 })]}>
					{tokens.map((token) => (
						<li key={token.id} mix={[flex(), flexWrap("wrap"), gap(2), items("center")]}>
							<Text mix={[text("sm")]}>{token.name}</Text>

							<Text mix={[text("xs"), fg("neutral.muted")]}>
								{ctx.i18next.t(`agent.scopes.${token.scope}`)}
							</Text>

							<Text mix={[text("xs"), fg("neutral.muted")]}>{stateOf(ctx, token, now)}</Text>

							<Text mix={[text("xs"), fg("neutral.muted")]}>
								{ctx.i18next.t("agent.tokens.expires", {
									date: exactDate(token.expiresAt, ctx.locale),
								})}
							</Text>

							{isLive(token, now) && (
								/**
								 * A method override rather than a `DELETE` a form cannot send, which is how
								 * every other revocation on this app's surface reaches its route.
								 */
								<form method="post" action={routes.tokens.revoke.href({ tokenId: token.id })}>
									<input type="hidden" name="_method" value="DELETE" />

									<Button type="submit" color="neutral" variant="outline">
										{ctx.i18next.t("agent.tokens.revoke")}
									</Button>
								</form>
							)}
						</li>
					))}
				</ul>
			)}

			{entitled && (
				<form
					method="post"
					action={routes.tokens.create.href()}
					mix={[vstack({ gap: 3, align: "start" }), mbs(2), maxIs(PAGE_COLUMN)]}
				>
					<div mix={[vstack({ gap: 2, align: "start" }), maxIs("100%")]}>
						<Label htmlFor={NAME_ID}>{ctx.i18next.t("agent.mint.name")}</Label>

						<Input
							id={NAME_ID}
							name={NAME_FIELD}
							required
							maxLength={TOKEN_NAME_MAX}
							placeholder={ctx.i18next.t("agent.mint.placeholder")}
						/>
					</div>

					<div mix={[vstack({ gap: 2, align: "start" }), maxIs("100%")]}>
						<Label htmlFor={SCOPE_ID}>{ctx.i18next.t("agent.mint.scope")}</Label>

						<Select id={SCOPE_ID} name={SCOPE_FIELD}>
							{AGENT_SCOPES.map((scope) => (
								<Select.Option key={scope} value={scope} selected={scope === "read"}>
									{ctx.i18next.t(`agent.scopes.${scope}`)}
								</Select.Option>
							))}
						</Select>

						<Description>{ctx.i18next.t("agent.mint.scopeHint")}</Description>
					</div>

					<Button type="submit">{ctx.i18next.t("agent.mint.submit")}</Button>
				</form>
			)}
		</section>
	);
}
