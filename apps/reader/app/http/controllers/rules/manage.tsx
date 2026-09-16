/**
 * The filter surface for `/rules`: every rule the reader has written, the form that writes
 * another, and the preview of one they are still typing.
 *
 * `GET` draws the list and, when the query carries a candidate, what that candidate would
 * have caught among the reader's newest posts — which is the only thing here that looks
 * backwards, and it looks without writing. `POST` writes a rule, and reports what it did in
 * the query of the redirect that lands the reader back on this page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { redirect } from "@sdxc/http/response";
import { borderEdge, fg } from "@sdxc/u/color";
import { flex, flexWrap, gap, grow, items, vstack } from "@sdxc/u/layout";
import { m, maxIs, minIs, pbs } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Alert, Button, Description, Input, Label, Select, Text } from "@sdxc/ui";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createController } from "remix/router";

import type { UserStore } from "~/database/user-do";

import { chrome } from "~/app/http/controllers/chrome";
import { exactDate, timelineCopy, timelineEntries } from "~/app/http/controllers/timeline-entries";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { features } from "~/app/lib/flags";
import { RULE_ACTIONS, RULE_FIELDS, RULE_VALUE_LENGTH } from "~/database/schema";
import { userStore } from "~/database/user-do";
import AppLayout, { PAGE_COLUMN, pageNote } from "~/resources/layouts/app";
import Timeline from "~/resources/views/timeline";
import routes from "~/routes/web";

/** The field a rule's part of a post is submitted under, wherever one is named. */
export const FIELD_FIELD = "field";

/** The field a rule's text is submitted under. */
export const VALUE_FIELD = "value";

/** The field a rule's action is submitted under. */
export const ACTION_FIELD = "action";

/** The field a rule's scope is submitted under, empty for one covering every feed. */
export const FEED_FIELD = "feed";

/** The query parameter this page reads the outcome of a rule action out of. */
export const RULE_PARAM = "rule";

/** The query parameter a completed one-off over a previewed page reports its count in. */
export const APPLIED_PARAM = "applied";

/** Ties the text field to the label naming it. */
const VALUE_ID = "rule-value";

/** Ties the part-of-post picker to the label naming it. */
const FIELD_ID = "rule-field";

/** Ties the action picker to the label naming it. */
const ACTION_ID = "rule-action";

/** Ties the scope picker to the label naming it. */
const FEED_ID = "rule-feed";

/** A rule as every form on this page submits it. */
const RuleForm = f.object({
	[FIELD_FIELD]: f.field(s.defaulted(s.string(), "")),
	[VALUE_FIELD]: f.field(s.defaulted(s.string(), "")),
	[ACTION_FIELD]: f.field(s.defaulted(s.string(), "")),
	[FEED_FIELD]: f.field(s.defaulted(s.string(), "")),
});

/**
 * Reads a rule out of a submission, which is the same four fields wherever it came from.
 *
 * @param formData - The submitted body.
 */
export function submittedRule(formData: FormData): UserStore.RuleDraft {
	let submitted = s.parse(RuleForm, formData);
	let feed = submitted[FEED_FIELD].trim();

	return {
		feedId: feed.length === 0 ? null : feed,
		field: submitted[FIELD_FIELD],
		value: submitted[VALUE_FIELD],
		action: submitted[ACTION_FIELD],
	};
}

/**
 * The candidate a query carries, or `null` for a plain view of the page. A candidate with
 * no text is not one: the preview is what a reader asked for by typing something.
 *
 * @param params - The query the page was asked for with.
 */
function candidateOf(params: URLSearchParams): UserStore.RuleDraft | null {
	let value = params.get(VALUE_FIELD) ?? "";
	if (value.trim().length === 0) return null;

	let feed = params.get(FEED_FIELD) ?? "";

	return {
		feedId: feed.trim().length === 0 ? null : feed,
		field: params.get(FIELD_FIELD) ?? RULE_FIELDS[0],
		value,
		action: params.get(ACTION_FIELD) ?? RULE_ACTIONS[0],
	};
}

/** Where this page is, carrying what just happened on it. */
export function rulesPage(outcome: string, extra: Record<string, string> = {}): string {
	let query = new URLSearchParams({ [RULE_PARAM]: outcome, ...extra });
	return `${routes.rules.index.href()}?${query}`;
}

/**
 * The copy and tone for the outcome a redirect carries, or `null` for an ordinary view of
 * the page and for a value this page has no sentence for.
 *
 * @param ctx - The request's dictionary and the query it arrived with.
 */
function notice(
	ctx: RequestContext,
): { message: string; color: "success" | "warning" | "danger" } | null {
	let applied = ctx.url.searchParams.get(APPLIED_PARAM);

	if (applied !== null && /^\d+$/.test(applied)) {
		return {
			message: ctx.i18next.t("rules.preview.applied", { count: Number.parseInt(applied, 10) }),
			color: "success",
		};
	}

	let outcome = ctx.url.searchParams.get(RULE_PARAM);

	if (outcome === "created")
		return { message: ctx.i18next.t("rules.notice.created"), color: "success" };
	if (outcome === "updated")
		return { message: ctx.i18next.t("rules.notice.updated"), color: "success" };
	if (outcome === "deleted")
		return { message: ctx.i18next.t("rules.notice.deleted"), color: "success" };

	if (outcome === "rule-limit") {
		return { message: ctx.i18next.t("rules.notice.limit"), color: "warning" };
	}

	if (outcome === "not-entitled") {
		return { message: ctx.i18next.t("rules.notice.notEntitled"), color: "warning" };
	}

	if (outcome === "invalid-value") {
		return { message: ctx.i18next.t("rules.notice.invalidValue"), color: "danger" };
	}

	if (outcome === "invalid-field") {
		return { message: ctx.i18next.t("rules.notice.invalidField"), color: "danger" };
	}

	if (outcome === "invalid-action") {
		return { message: ctx.i18next.t("rules.notice.invalidAction"), color: "danger" };
	}

	if (outcome === "not-following") {
		return { message: ctx.i18next.t("rules.notice.notFollowing"), color: "danger" };
	}

	if (outcome === "not-found") {
		return { message: ctx.i18next.t("rules.notice.missing"), color: "warning" };
	}

	return null;
}

/**
 * One rule read back as the sentence it is, in the reader's own language, with the feed it
 * is scoped to named rather than spelled as an id.
 *
 * @param ctx - The request's dictionary.
 * @param rule - The rule being read back.
 * @param feeds - The reader's subscriptions, for naming the one a rule is scoped to.
 */
function sentenceFor(
	ctx: RequestContext,
	rule: UserStore.Rule,
	feeds: readonly UserStore.FeedSummary[],
): { sentence: string; scope: string } {
	let sentence = ctx.i18next.t("rules.sentence", {
		field: ctx.i18next.t(`rules.fields.${rule.field}`),
		value: rule.value,
		action: ctx.i18next.t(`rules.actions.${rule.action}`),
	});

	let feed = feeds.find((followed) => followed.id === rule.feedId);

	let scope =
		rule.feedId === null || feed === undefined
			? ctx.i18next.t("rules.scope.all")
			: ctx.i18next.t("rules.scope.feed", { feed: feed.title });

	return { sentence, scope };
}

/** Renders the page, with whatever a candidate in the query would have caught. */
async function rulesView(
	ctx: RequestContext,
	held: UserStore.Rule[],
	feeds: UserStore.FeedSummary[],
	entitled: boolean,
	candidate: UserStore.RuleDraft | null,
	preview: UserStore.RulePreview | null,
) {
	let outcome = notice(ctx);

	/** The rows the preview caught, drawn as the same list every reading surface draws. */
	let previewed =
		preview !== null && preview.ok
			? timelineEntries(
					ctx,
					preview.items,
					new Map(preview.feeds.map((feed) => [feed.id, feed.title])),
				)
			: [];

	return ctx.render(
		<AppLayout
			documentTitle={ctx.i18next.t("rules.title")}
			heading={ctx.i18next.t("rules.heading")}
			locale={ctx.locale}
			{...await chrome(ctx)}
		>
			<section mix={[vstack({ gap: 3 }), maxIs(PAGE_COLUMN)]}>
				<Description>{ctx.i18next.t("rules.description")}</Description>
				<Text mix={[text("xs"), fg("neutral.muted")]}>{ctx.i18next.t("rules.summaryCaveat")}</Text>

				{!entitled && (
					<Alert color="warning">
						<Alert.Content>
							<Alert.Description>{ctx.i18next.t("rules.notEntitled")}</Alert.Description>
						</Alert.Content>
					</Alert>
				)}
			</section>

			{outcome && (
				<Alert color={outcome.color} mix={[maxIs(PAGE_COLUMN), ...pageNote()]}>
					<Alert.Content>
						<Alert.Description>{outcome.message}</Alert.Description>
					</Alert.Content>
				</Alert>
			)}

			{/**
			 * The rules themselves, each read back as the sentence it is, with the two numbers
			 * that say whether it is doing anything. A rule that has never matched is the most
			 * common real failure, so it says so rather than printing a zero.
			 */}
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
					{ctx.i18next.t("rules.heading")}
				</h2>

				{held.length === 0 && <Text mix={[text("sm")]}>{ctx.i18next.t("rules.empty")}</Text>}

				{held.map((rule) => {
					let read = sentenceFor(ctx, rule, feeds);

					return (
						<div
							key={rule.id}
							mix={[
								vstack({ gap: 1 }),
								pbs(3),
								borderEdge("block-start", { color: "neutral.border", width: 1 }),
							]}
						>
							<Text mix={[text("sm"), weight("medium")]}>{read.sentence}</Text>
							<Text mix={[text("xs"), fg("neutral.muted")]}>{read.scope}</Text>

							<Text mix={[text("xs"), fg("neutral.muted")]}>
								{rule.matches === 0
									? ctx.i18next.t("rules.neverMatched")
									: ctx.i18next.t("rules.matched", { count: rule.matches })}{" "}
								{rule.lastMatchedAt !== null &&
									ctx.i18next.t("rules.lastMatched", {
										date: exactDate(rule.lastMatchedAt, ctx.locale),
									})}
							</Text>

							<form method="post" action={routes.rule.delete.href({ ruleId: rule.id })}>
								{/** A browser form sends `GET` and `POST`, so the verb travels in the body. */}
								<input type="hidden" name="_method" value="DELETE" />

								<Button type="submit" color="neutral" variant="outline">
									{ctx.i18next.t("rules.form.delete")}
								</Button>
							</form>
						</div>
					);
				})}
			</section>

			{/**
			 * One form, used twice: `GET` previews the candidate against the newest posts and
			 * `POST` writes it. Both carry the same four fields, so what a reader previewed is
			 * exactly what they save.
			 */}
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
					{ctx.i18next.t("rules.form.legend")}
				</h2>

				<form method="get" action={routes.rules.index.href()} mix={[vstack({ gap: 3 })]}>
					<div mix={[vstack({ gap: 2, align: "start" }), maxIs("100%")]}>
						<Label htmlFor={FIELD_ID}>{ctx.i18next.t("rules.fields.legend")}</Label>

						<Select id={FIELD_ID} name={FIELD_FIELD}>
							{RULE_FIELDS.map((offered) => (
								<Select.Option
									key={offered}
									value={offered}
									selected={candidate?.field === offered}
								>
									{ctx.i18next.t(`rules.fields.${offered}`)}
								</Select.Option>
							))}
						</Select>
					</div>

					<div mix={[vstack({ gap: 2, align: "start" }), maxIs("100%")]}>
						<Label htmlFor={VALUE_ID}>{ctx.i18next.t("rules.form.value")}</Label>

						<Input
							id={VALUE_ID}
							name={VALUE_FIELD}
							required
							maxLength={RULE_VALUE_LENGTH}
							value={candidate?.value ?? ""}
							placeholder={ctx.i18next.t("rules.form.valuePlaceholder")}
							mix={[minIs("16rem")]}
						/>
					</div>

					<div mix={[vstack({ gap: 2, align: "start" }), maxIs("100%")]}>
						<Label htmlFor={ACTION_ID}>{ctx.i18next.t("rules.actions.legend")}</Label>

						<Select id={ACTION_ID} name={ACTION_FIELD}>
							{RULE_ACTIONS.map((offered) => (
								<Select.Option
									key={offered}
									value={offered}
									selected={candidate?.action === offered}
								>
									{ctx.i18next.t(`rules.actions.${offered}`)}
								</Select.Option>
							))}
						</Select>
					</div>

					<div mix={[vstack({ gap: 2, align: "start" }), maxIs("100%")]}>
						<Label htmlFor={FEED_ID}>{ctx.i18next.t("rules.form.feed")}</Label>

						<Select id={FEED_ID} name={FEED_FIELD}>
							<Select.Option value="" selected={candidate?.feedId == null}>
								{ctx.i18next.t("rules.form.allFeeds")}
							</Select.Option>

							{feeds.map((feed) => (
								<Select.Option
									key={feed.id}
									value={feed.id}
									selected={candidate?.feedId === feed.id}
								>
									{feed.title}
								</Select.Option>
							))}
						</Select>
					</div>

					<div mix={[flex(), flexWrap("wrap"), gap(2), items("center")]}>
						<Button type="submit" color="neutral" variant="outline">
							{ctx.i18next.t("rules.preview.submit")}
						</Button>

						{/**
						 * The same fields, sent to this page's own `POST` rather than to its `GET`,
						 * which is what makes previewing and saving one form with two buttons.
						 */}
						<Button type="submit" formMethod="post" formAction={routes.rules.action.href()}>
							{ctx.i18next.t("rules.form.submit")}
						</Button>
					</div>
				</form>
			</section>

			{/**
			 * What the candidate would have caught, read-only: a list of posts the reader can
			 * still see, which is also the answer to "why is this rule not working".
			 */}
			{preview !== null && preview.ok && (
				<section
					mix={[
						vstack({ gap: 3 }),
						pbs(6),
						borderEdge("block-start", { color: "neutral.border", width: 1 }),
					]}
				>
					{/** Level 2, since the layout's own page heading is the document's only `h1`. */}
					<h2 mix={[m(0), text("sm"), weight("medium"), fg("neutral.emphasis")]}>
						{ctx.i18next.t("rules.preview.legend")}
					</h2>

					{preview.matched === 0 ? (
						<Text mix={[text("sm")]}>
							{ctx.i18next.t("rules.preview.none", { scanned: preview.scanned })}
						</Text>
					) : (
						<Text mix={[text("sm")]}>
							{ctx.i18next.t("rules.preview.result", {
								count: preview.matched,
								scanned: preview.scanned,
							})}
						</Text>
					)}

					{/**
					 * A term every post of a feed carries leaves the subscription synchronizing into
					 * an empty timeline, and no freshness check ever calls it stale, so it is said
					 * here while the reader is still looking at what it would do.
					 */}
					{preview.scanned > 0 && preview.matched === preview.scanned && (
						<Alert color="warning">
							<Alert.Content>
								<Alert.Description>{ctx.i18next.t("rules.preview.everything")}</Alert.Description>
							</Alert.Content>
						</Alert>
					)}

					{preview.matched > 0 && candidate !== null && (
						<form
							method="post"
							action={routes.rule.apply.href()}
							mix={[flex(), gap(2), items("center"), grow()]}
						>
							<input type="hidden" name={FIELD_FIELD} value={candidate.field} />
							<input type="hidden" name={VALUE_FIELD} value={candidate.value} />
							<input type="hidden" name={ACTION_FIELD} value={candidate.action} />
							<input type="hidden" name={FEED_FIELD} value={candidate.feedId ?? ""} />

							<Button type="submit" color="neutral" variant="outline">
								{ctx.i18next.t("rules.preview.apply", { count: preview.matched })}
							</Button>
						</form>
					)}

					{previewed.length > 0 && (
						<Timeline
							entries={previewed}
							copy={timelineCopy(ctx.i18next)}
							returnTo={`${ctx.url.pathname}${ctx.url.search}`}
							cursors={{ next: null, prev: null }}
						/>
					)}
				</section>
			)}
		</AppLayout>,
	);
}

export default createController(routes.rules, {
	middleware: [requireUser],
	actions: {
		/** GET /rules — the reader's rules, and what a candidate in the query would catch. */
		async index(ctx) {
			let viewer = getViewer();
			if (!viewer) throw new Error("requireUser must run before this handler");

			/**
			 * With filters off there is nothing here to show and no way to put anything here,
			 * so a reader following a bookmark is sent to the queue rather than shown a page
			 * whose every control refuses.
			 */
			if (!(await ctx.flags.get(features.filterRules))) {
				return redirect(routes.reading.index.href(), { status: redirect.Status.SeeOther });
			}

			let store = userStore(viewer.id);
			let candidate = candidateOf(ctx.url.searchParams);

			let [held, feeds, entitlement, preview] = await Promise.all([
				store.listRules(),
				store.listFeeds(),
				store.entitlement(),
				candidate === null ? Promise.resolve(null) : store.previewRule(candidate),
			]);

			return await rulesView(ctx, held, feeds, entitlement.limits.filterRules, candidate, preview);
		},

		/** POST /rules — writes a rule, which acts on what arrives from now on. */
		async action(ctx) {
			let viewer = getViewer();
			if (!viewer) throw new Error("requireUser must run before this handler");

			if (!(await ctx.flags.get(features.filterRules))) {
				return redirect(routes.reading.index.href(), { status: redirect.Status.SeeOther });
			}

			let created = await userStore(viewer.id).createRule(submittedRule(ctx.formData));

			return redirect(rulesPage(created.ok ? "created" : created.reason), {
				status: redirect.Status.SeeOther,
			});
		},
	},
});
