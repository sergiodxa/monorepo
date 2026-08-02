/**
 * `/try` — the public try-it page, and the only page in this feature that sells.
 *
 * One URL, two methods. The `GET` renders the URL box and nothing else; the `POST` guards
 * the submission, runs the check, and renders that same page with the answer in it. There
 * is no round trip between the two, which is the whole point: nothing about a check has to
 * survive between requests, so a reload of the `GET` cannot show a stale result and every
 * link back here lands on a fresh, empty form. Both methods go through
 * {@link renderTrialPage}, so neither can grow a version of the page the other does not
 * have.
 *
 * Arriving with `?url=` only pre-fills the field. Running a probe is always the `POST`, so
 * a link preview, a crawler, or a pasted URL can never spend one.
 *
 * The cost of rendering on the `POST` is that a browser reload re-submits. That is the
 * ordinary bargain and it lands somewhere the page already handles: the per-IP limit is one
 * check a minute, so a reload inside the minute comes back as a `rate-limited` refusal that
 * says so and leaves the URL in the box, ready to run again.
 *
 * ## What the page withholds, and when
 *
 * Before a check has run the page is a heading, one line, and a field — given the screen and
 * centred in it. The three selling sections below it (what the week gives you, what it
 * cannot show, and the offer) are all withheld until there is a result, because every one of
 * them argues about something the visitor has not seen yet: four cards about a week of
 * watching and a closing pitch badged "After the week" are answers to a question nobody has
 * asked on a page where nothing has been typed, and they push the one field further down.
 *
 * The intro paragraph and the URL box go the other way and disappear once a check has run.
 * The intro explains what the page is about to do, and by then it has done it. The box is
 * replaced by the answer it produced, rather than sitting above it: the result is what the
 * visitor came back for and it belongs where their eye already is. Checking a second URL is
 * a plain link under the card to `GET /try`, which is genuinely an empty form now that the
 * page carries no state between requests. A link and not a button, and outside the card
 * rather than in it, because it is a way back rather than a peer of the primary action —
 * two buttons of competing weight stacked in the card's footer is what made the old one
 * read as unplaced.
 *
 * ## What the result card leads with
 *
 * The URL is the card's title and the status badge is the largest thing under it, in that
 * order, because those are the two things being scanned for — the more so once more than
 * one URL has been checked. Neither the timings nor the timestamp is why anybody is here, so
 * they support the badge rather than share its weight.
 *
 * A `3xx` gets its own branch. Trial probes do not follow redirects — that refusal is what
 * stops a `302` walking past the address checks `trial-guard.ts` just made — so a site that
 * sends `http://` to `https://` comes back as a `301` and grades `down` against the expected
 * `200`. The page must not repeat that grade at somebody whose site is perfectly healthy, so
 * it names the redirect for what it is and offers the destination as a fresh check rather
 * than following it. The email form is withheld in that branch too: a week of hourly checks
 * on a URL we already know we will grade `down` every time would produce a digest reporting
 * 0% uptime for a healthy site.
 *
 * The view is inlined rather than split into `resources/views`: it is one page, and nothing
 * on it is hydrated. {@link renderTrialPage} is exported all the same, because
 * `POST /try/lead` re-renders this page when the address it was given cannot be used.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@pkg/i18n";
import type { Handle, RemixNode } from "remix/ui";

import { logger } from "@pkg/logger";
import {
	ActivityIcon,
	ArrowRightIcon,
	BellIcon,
	ClockIcon,
	CreditCardIcon,
	GlobeIcon,
	MailIcon,
	NetworkIcon,
} from "@pkg/lucide-remix";
import {
	Alert,
	Badge,
	Button,
	Card,
	Checkbox,
	Description,
	Heading,
	HeadingScope,
	LinkButton,
	Text,
	TextField,
} from "@pkg/r3-ui";
import { isFailure } from "@pkg/result";
import { bg, fg, linearGradient } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import {
	flex,
	flexWrap,
	gap,
	grid,
	gridTemplate,
	inlineFlex,
	items,
	justify,
	vstack,
} from "@pkg/u/layout";
import { dark, media } from "@pkg/u/responsive";
import { bs, is, m, maxIs, mbs, mi, minBs, p, pb, pbe, pbs, pi, pis } from "@pkg/u/size";
import { hover } from "@pkg/u/state";
import {
	fontSize,
	leading,
	lineClamp,
	textAlign,
	textDecoration,
	tracking,
	weight,
	wordBreak,
} from "@pkg/u/typography";
import { getContext } from "remix/async-context-middleware";
import { createController } from "remix/fetch-router";
import { Session } from "remix/session";
import { css } from "remix/ui";

import type { TrialProbeState } from "~/app/http/controllers/trial/session";
import type { HttpProbeOutcome } from "~/app/services/http-check";
import type { TrialRefusalReason } from "~/app/services/trial-guard";
import type { MonitorStatus } from "~/database/schema";

import {
	TRIAL_PROBE,
	TRIAL_WATCH_STARTED,
	isRedirectProbe,
	takeTrialState,
} from "~/app/http/controllers/trial/session";
import { getViewer } from "~/app/http/middleware/auth";
import { TRIAL_URL_FIELD, TURNSTILE_FIELD } from "~/app/http/validators/trial";
import { BASE_PRICE_USD } from "~/app/lib/pricing";
import { SEO } from "~/app/lib/seo";
import { trialProbeOptions } from "~/app/lib/trial-probe";
import { HttpCheck } from "~/app/services/http-check";
import { guardTrialProbe, trialTurnstileSiteKey } from "~/app/services/trial-guard";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/** Cloudflare's Turnstile loader. Fetched only when this deployment has a site key. */
const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/**
 * Longest pre-fill accepted from `?url=`. The value is only ever echoed into an input, and
 * JSX escapes it, so this is not an injection guard — it is a cap on how much of somebody
 * else's query string this page will render for them.
 */
const MAX_PREFILL_LENGTH = 2048;

/** DOM id tying the marketing opt-in's explanation to the checkbox it explains. */
const CONSENT_NOTE_ID = "trial-consent-note";

/**
 * How many lines of URL the result card's heading shows before clamping.
 *
 * A tracking-stuffed URL is six lines of bold type on a phone, which buries the answer
 * under the question all over again. The clamp is visual only — the whole URL is still the
 * heading's text, so it is still announced, still selectable, and still copied whole.
 *
 * It is applied as `lineClamp()` plus a hand-written `-webkit-line-clamp`, because the
 * utility alone does not currently work: the style engine appends `px` to numeric values
 * for every property outside its unitless allowlist, `-webkit-line-clamp` is not on that
 * list, and `3px` is dropped by the CSSOM. Passing the count as a string skips that path.
 * Drop the second mixin once the allowlist covers it.
 */
const TITLE_MAX_LINES = 3;

/**
 * Inline-start offset that lines a checkbox's description up with its label text rather
 * than with the glyph: `Checkbox`'s 1.25rem box plus the 0.5rem gap of the row it sits in.
 */
const CHECKBOX_LABEL_OFFSET = "1.75rem";

/**
 * Height of `MarketingLayout`'s sticky header, measured from the rendered page. The layout
 * exposes no custom property for it, so this is the only place the number lives, and it is
 * only ever subtracted from the viewport — a stale value costs a few pixels of the peek
 * below, never a broken or clipped page.
 */
const HEADER_BLOCK_SIZE = "65px";

/**
 * How much of whatever comes next stays on screen when the page is nothing but a form.
 * Enough to say the page continues, not enough to compete with the one field on it.
 */
const FIRST_SCREEN_PEEK = "72px";

/**
 * `dvh` rather than `vh`: on a phone `100vh` is the viewport with the browser chrome
 * retracted, so a `100vh` block overflows the screen it was supposed to fit and the page
 * scrolls when it should not. And a minimum rather than a height, so a small screen whose
 * content does not fit simply grows past it instead of clipping the form.
 */
const FIRST_SCREEN_MIN_BLOCK_SIZE = `calc(100dvh - ${HEADER_BLOCK_SIZE} - ${FIRST_SCREEN_PEEK})`;

/**
 * Why the last submission never became a check.
 *
 * `unavailable` is not one of the guard's reasons — it is the fifth thing that can go
 * wrong, and it is on our side: the guard said yes and the Durable Object that performs the
 * probe could not be reached, so nothing at all was learned about the target. It is kept
 * apart from `blocked-target` and from a `down` result because both of those are statements
 * about the visitor's URL, and this one is a statement about us.
 */
export type TrialRefusalCode = TrialRefusalReason | "unavailable";

/** A refused submission, as the page needs to explain it. */
export interface TrialRefusalState {
	code: TrialRefusalCode;
	/**
	 * Seconds until a retry could work, when the refusal knows. Only a rate limit does;
	 * everything else carries `null` and the copy says nothing about waiting.
	 */
	retryAfterSeconds: number | null;
}

/** Everything that varies between the four ways this page can be reached. */
export interface TrialPageView {
	/** The check that ran, when one did. */
	probe?: TrialProbeState;
	/** Why no check ran, when none did. */
	refusal?: TrialRefusalState;
	/** The URL a watch was just opened for, rendered once as a receipt. */
	watching?: string;
	/** Whether the address just submitted to the email form failed validation. */
	leadError?: boolean;
	/** Starting value for the URL box, when no probe supplies one. */
	prefill?: string;
}

/**
 * Vertical rhythm for the selling sections, every one of which follows a section that
 * already ends with its own bottom padding. Two neighbours each contributing a full gap
 * across one boundary stacks the two into a dead band, so each section here owns only the
 * space below it and starts flush against the one above.
 */
function sectionPadding() {
	return [
		pbs(0),
		pbe(16),
		media("(min-width: 640px)", pbe(24)),
		media("(min-width: 1024px)", pbe(32)),
	];
}

/**
 * The closing CTA's own rhythm. It needs real padding on both sides because its tint makes
 * it a visible band rather than a boundary, but not a marketing chapter's 128px: one
 * heading, one line and two buttons inside that much space read as most of an empty screen.
 */
function ctaPadding() {
	return [pbs(10), pbe(10), media("(min-width: 1024px)", [pbs(14), pbe(14)])];
}

/** Centered content wrapper shared by every section, matching the rest of the marketing site. */
function marketingContainer() {
	return [
		maxIs("1152px"),
		mi("auto"),
		pi(4),
		media("(min-width: 640px)", pi(6)),
		media("(min-width: 1024px)", pi(8)),
	];
}

/** One card in either of the two selling grids. */
interface SellingPoint {
	icon: RemixNode;
	title: string;
	description: string;
}

/** Prop types for {@link SellingGrid}. */
namespace SellingGrid {
	export interface Props {
		/** The cards to lay out, in reading order. */
		points: SellingPoint[];
	}
}

/**
 * The card grid both selling sections are built from, so the four benefits of the week and
 * the three things the week cannot show read as one design rather than two.
 *
 * `auto-fit` rather than a column count per breakpoint because the two callers do not have
 * the same number of cards: one track sizing serves four across and three across at the
 * same container width, and collapses to two and then one on its own as the viewport
 * narrows.
 *
 * @param handle - Runtime handle carrying the grid's props.
 * @returns The render function producing the grid.
 */
function SellingGrid(handle: Handle<SellingGrid.Props>) {
	return () => {
		let { points } = handle.props;

		return (
			<div
				mix={[
					grid(),
					gap(6),
					mbs(10),
					gridTemplate({ columns: "repeat(auto-fit, minmax(240px, 1fr))" }),
				]}
			>
				{points.map((item) => (
					<Card key={item.title}>
						<Card.Content mix={[vstack({ gap: 3 }), p(6)]}>
							<span
								mix={[
									inlineFlex(),
									items("center"),
									justify("center"),
									is("40px"),
									bs("40px"),
									rounded("10px"),
									bg("brand.tint"),
									fg("brand"),
								]}
							>
								{item.icon}
							</span>
							<Heading level={3} mix={[m(0), fontSize("base")]}>
								{item.title}
							</Heading>
							<Text>{item.description}</Text>
						</Card.Content>
					</Card>
				))}
			</div>
		);
	};
}

/**
 * The result badge, scaled up from `Badge`'s caption-sized default.
 *
 * This badge is the payload of the whole page — the one thing the visitor came to be told.
 * At the default `xs` it read as a label on the numbers beside it rather than as the answer,
 * which put the least important thing on the card at the same weight as the most.
 */
function resultBadge() {
	return [fontSize("base"), pi(3), pb(1)];
}

/** The badge tone each check outcome reads in: the same three colors the dashboard uses. */
function statusColor(status: MonitorStatus): Badge.Color {
	if (status === "up") return "success";
	if (status === "degraded") return "warning";
	return "danger";
}

/**
 * The one line under the status badge: the code the target answered with and how long it
 * took, or the wording for a target that never answered at all rather than a code it
 * never sent.
 *
 * @param probe - The check that ran.
 * @param t - The request's translator.
 * @returns A finished line, ready to render.
 */
function resultDetail(probe: TrialProbeState, t: TFunction): string {
	let code =
		probe.responseStatus === null
			? t("page.trial.result.noResponse")
			: t("page.trial.result.httpStatus", { status: probe.responseStatus });
	if (probe.responseTimeMs === null) return code;

	return `${code} · ${t("page.trial.result.milliseconds", { value: Math.round(probe.responseTimeMs) })}`;
}

/**
 * The sentence a refusal is explained with.
 *
 * Every reason gets its own, because collapsing them would make the page lie about the one
 * thing it exists to report: "we have stopped for today" and "your site did not answer"
 * are different facts, and a visitor who cannot tell them apart learns nothing from
 * either. The rate limit is the only refusal that knows when a retry could work, so it is
 * the only one whose copy mentions waiting, and it falls back to a wordless version when
 * the limiter reported no window.
 *
 * @param refusal - What the guard, or the prober, refused with.
 * @param t - The request's translator.
 * @returns The sentence to show.
 */
function refusalMessage(refusal: TrialRefusalState, t: TFunction): string {
	if (refusal.code === "rate-limited") {
		if (refusal.retryAfterSeconds === null) return t("page.trial.refusal.rateLimited");
		return t("page.trial.refusal.rateLimitedFor", { seconds: refusal.retryAfterSeconds });
	}
	if (refusal.code === "blocked-target") return t("page.trial.refusal.blockedTarget");
	if (refusal.code === "failed-challenge") return t("page.trial.refusal.failedChallenge");
	if (refusal.code === "budget-exhausted") return t("page.trial.refusal.budgetExhausted");
	return t("page.trial.refusal.unavailable");
}

/**
 * Renders `/try`, in whichever of its states the caller reached.
 *
 * The single code path both methods answer through, and the reason the empty page and the
 * answered one cannot drift apart: the `GET` passes no result, the `POST` passes what it
 * got, and `POST /try/lead` passes the probe back with the error its form produced.
 *
 * @param view - What this particular request has to show.
 * @returns The rendered document.
 */
export function renderTrialPage(view: TrialPageView = {}) {
	let ctx = getContext();
	let t = ctx.i18next.t;
	let { probe, refusal, watching, leadError } = view;

	let siteKey = trialTurnstileSiteKey();
	let chrome = buildMarketingChrome(t);

	let prefill = (view.prefill ?? "").slice(0, MAX_PREFILL_LENGTH);
	let redirected = probe !== undefined && isRedirectProbe(probe);

	let checkedAt = probe
		? new Intl.DateTimeFormat(ctx.locale, { dateStyle: "medium", timeStyle: "short" }).format(
				new Date(probe.checkedAt),
			)
		: "";

	let benefits: SellingPoint[] = [
		{
			icon: <ClockIcon size={24} strokeWidth={1.5} aria-hidden />,
			title: t("page.trial.benefits.list.hourly.title"),
			description: t("page.trial.benefits.list.hourly.description"),
		},
		{
			icon: <BellIcon size={24} strokeWidth={1.5} aria-hidden />,
			title: t("page.trial.benefits.list.changes.title"),
			description: t("page.trial.benefits.list.changes.description"),
		},
		{
			icon: <MailIcon size={24} strokeWidth={1.5} aria-hidden />,
			title: t("page.trial.benefits.list.digest.title"),
			description: t("page.trial.benefits.list.digest.description"),
		},
		{
			icon: <CreditCardIcon size={24} strokeWidth={1.5} aria-hidden />,
			title: t("page.trial.benefits.list.noAccount.title"),
			description: t("page.trial.benefits.list.noAccount.description"),
		},
	];

	/**
	 * The three monitor types the free week cannot demonstrate, in the app's own icons for
	 * them so the page and the product name the same things the same way.
	 */
	let beyondHttp: SellingPoint[] = [
		{
			icon: <NetworkIcon size={24} strokeWidth={1.5} aria-hidden />,
			title: t("page.trial.more.list.tcp.title"),
			description: t("page.trial.more.list.tcp.description"),
		},
		{
			icon: <GlobeIcon size={24} strokeWidth={1.5} aria-hidden />,
			title: t("page.trial.more.list.dns.title"),
			description: t("page.trial.more.list.dns.description"),
		},
		{
			icon: <ClockIcon size={24} strokeWidth={1.5} aria-hidden />,
			title: t("page.trial.more.list.cron.title"),
			description: t("page.trial.more.list.cron.description"),
		},
	];

	/**
	 * The subscription price, formatted for the request's locale and interpolated rather
	 * than written into six translations, so `~/app/lib/pricing` stays the only place the
	 * product's price is stated.
	 */
	let price = BASE_PRICE_USD.toLocaleString(ctx.locale, {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	});

	/**
	 * With nothing to report, the page is one field and a button, so it is given the screen
	 * and its content is centred in it — with a sliver of the footer left showing so it
	 * reads as a page that continues rather than one that ends. The moment a check has run
	 * the floor is dropped: the answer is what the visitor came back for, and a
	 * viewport-tall first section would push it down behind empty space.
	 */
	let firstScreen =
		probe === undefined ? [minBs(FIRST_SCREEN_MIN_BLOCK_SIZE), vstack({ justify: "center" })] : [];

	return ctx.render(
		<DocumentLayout
			title={t("page.trial.meta.title")}
			locale={ctx.locale}
			seo={{
				description: t("page.trial.meta.description"),
				canonical: SEO.canonical(new URL(routes.trial.check.index.href(), ctx.url)),
			}}
		>
			<MarketingLayout isSignedIn={getViewer() !== null} {...chrome}>
				<section
					mix={[
						pbs(12),
						pbe(12),
						...firstScreen,
						bg({
							image: linearGradient(
								"to bottom",
								"var(--ui-brand-bg-tint)",
								"var(--ui-neutral-bg-tint)",
							),
						}),
					]}
				>
					<div mix={[...marketingContainer(), maxIs("720px")]}>
						<div mix={[vstack({ gap: 3, align: "center" }), textAlign("center")]}>
							<Heading
								level={1}
								mix={[
									m(0),
									fontSize("2xl"),
									weight(700),
									leading(1.15),
									tracking("tight"),
									media("(min-width: 640px)", fontSize("3xl")),
								]}
							>
								{t("page.trial.heading")}
							</Heading>
							{probe !== undefined ? null : (
								<p mix={[m(0), maxIs("560px"), fontSize("sm"), leading(1.6), fg("neutral")]}>
									{t("page.trial.intro")}
								</p>
							)}
						</div>

						{probe !== undefined ? null : (
							<Card mix={[mbs(8)]}>
								<Card.Content mix={[p(6)]}>
									<form
										method="post"
										action={routes.trial.check.action.href()}
										mix={[vstack({ gap: 4 })]}
									>
										<TextField
											name={TRIAL_URL_FIELD}
											type="url"
											label={t("page.trial.form.url.label")}
											description={t("page.trial.form.url.description")}
											placeholder={t("page.trial.form.url.placeholder")}
											defaultValue={prefill}
											autoComplete="url"
											required
										/>

										{siteKey === null ? null : (
											<div
												class="cf-turnstile"
												data-sitekey={siteKey}
												data-response-field-name={TURNSTILE_FIELD}
												data-theme="auto"
											/>
										)}

										<Button type="submit" size="lg">
											{t("page.trial.form.submit")}
										</Button>
									</form>
								</Card.Content>
							</Card>
						)}

						{refusal === undefined ? null : (
							<Alert color="warning" live="polite" mix={[mbs(6)]}>
								<Alert.Content>
									<Alert.Title>{t("page.trial.refusal.title")}</Alert.Title>
									<Alert.Description>{refusalMessage(refusal, t)}</Alert.Description>
								</Alert.Content>
							</Alert>
						)}

						{watching === undefined ? null : (
							<Alert color="success" live="polite" mix={[mbs(6)]}>
								<Alert.Content>
									<Alert.Title>{t("page.trial.watching.title")}</Alert.Title>
									<Alert.Description>
										{t("page.trial.watching.description", { url: watching })}
									</Alert.Description>
								</Alert.Content>
							</Alert>
						)}

						{probe === undefined ? null : (
							<HeadingScope level={2}>
								<Card mix={[mbs(6)]}>
									<Card.Header>
										<Card.Title
											mix={[
												fontSize("lg"),
												leading(1.3),
												wordBreak("break-all"),
												lineClamp(TITLE_MAX_LINES),
												css({ WebkitLineClamp: `${TITLE_MAX_LINES}` }),
												media("(min-width: 640px)", fontSize("xl")),
											]}
										>
											{probe.url}
										</Card.Title>
									</Card.Header>

									<Card.Content mix={[vstack({ gap: 6 })]}>
										<div mix={[vstack({ gap: 2, align: "start" })]}>
											<div mix={[flex(), flexWrap("wrap"), items("center"), gap(3)]}>
												{redirected ? (
													<Badge color="brand" mix={[...resultBadge()]}>
														{t("page.trial.result.redirect.badge")}
													</Badge>
												) : (
													<Badge color={statusColor(probe.status)} mix={[...resultBadge()]}>
														{t(`page.trial.result.status.${probe.status}`)}
													</Badge>
												)}
												<Text>{resultDetail(probe, t)}</Text>
											</div>
											<Text mix={[fontSize("xs"), fg("neutral.muted")]}>
												{t("page.trial.result.checkedAt", { time: checkedAt })}
											</Text>
										</div>

										{redirected ? (
											<div mix={[vstack({ gap: 4 })]}>
												<div mix={[vstack({ gap: 2 })]}>
													<Heading level={3} mix={[m(0), fontSize("base")]}>
														{t("page.trial.result.redirect.title")}
													</Heading>
													<Text>{t("page.trial.result.redirect.description")}</Text>
												</div>

												{probe.location === null ? (
													<Text mix={[fg("neutral.muted")]}>
														{t("page.trial.result.redirect.unknownDestination")}
													</Text>
												) : (
													<form
														method="post"
														action={routes.trial.check.action.href()}
														mix={[vstack({ gap: 3, align: "start" })]}
													>
														<Text mix={[wordBreak("break-all")]}>
															{t("page.trial.result.redirect.destination", {
																url: probe.location,
															})}
														</Text>
														<input type="hidden" name={TRIAL_URL_FIELD} value={probe.location} />
														<Button type="submit" variant="outline">
															{t("page.trial.result.redirect.action")}
														</Button>
													</form>
												)}
											</div>
										) : (
											<div mix={[vstack({ gap: 2 })]}>
												<Heading level={3} mix={[m(0), fontSize("base")]}>
													{t("page.trial.lead.title")}
												</Heading>
												<Text>{t("page.trial.lead.description")}</Text>
											</div>
										)}

										{redirected ? null : (
											<form
												method="post"
												action={routes.trial.lead.href()}
												mix={[vstack({ gap: 4 })]}
											>
												<TextField
													name="email"
													type="email"
													label={t("page.trial.lead.email.label")}
													placeholder={t("page.trial.lead.email.placeholder")}
													errorMessage={leadError ? t("page.trial.lead.email.error") : undefined}
													autoComplete="email"
													required
												/>

												<div mix={[vstack({ gap: 1 })]}>
													<Checkbox name="consent" value="true" aria-describedby={CONSENT_NOTE_ID}>
														<span mix={[fontSize("sm")]}>{t("page.trial.lead.consent")}</span>
													</Checkbox>
													<Description id={CONSENT_NOTE_ID} mix={[pis(CHECKBOX_LABEL_OFFSET)]}>
														{t("page.trial.lead.consentNote")}
													</Description>
												</div>

												<Description>{t("page.trial.lead.promise")}</Description>

												<Button type="submit">{t("page.trial.lead.submit")}</Button>
											</form>
										)}
									</Card.Content>
								</Card>
							</HeadingScope>
						)}

						{probe === undefined ? null : (
							<p mix={[m(0), mbs(5), textAlign("center")]}>
								<a
									href={routes.trial.check.index.href()}
									mix={[
										fontSize("sm"),
										fg("neutral.muted"),
										textDecoration("underline"),
										hover(fg("neutral.emphasis")),
									]}
								>
									{t("page.trial.result.checkAnother")}
								</a>
							</p>
						)}
					</div>
				</section>

				{probe === undefined ? null : (
					<section mix={[...sectionPadding()]}>
						<div mix={[...marketingContainer()]}>
							<div
								mix={[
									vstack({ gap: 3, align: "center" }),
									textAlign("center"),
									maxIs("640px"),
									mi("auto"),
								]}
							>
								<Heading level={2} mix={[m(0), fontSize("2xl"), weight(700), tracking("tight")]}>
									{t("page.trial.benefits.title")}
								</Heading>
								<Text>{t("page.trial.benefits.description")}</Text>
							</div>

							<SellingGrid points={benefits} />
						</div>
					</section>
				)}

				{probe === undefined ? null : (
					<section mix={[...sectionPadding()]}>
						<div mix={[...marketingContainer()]}>
							<div
								mix={[
									vstack({ gap: 3, align: "center" }),
									textAlign("center"),
									maxIs("640px"),
									mi("auto"),
								]}
							>
								<Heading level={2} mix={[m(0), fontSize("2xl"), weight(700), tracking("tight")]}>
									{t("page.trial.more.title")}
								</Heading>
								<Text>{t("page.trial.more.description")}</Text>
							</div>

							<SellingGrid points={beyondHttp} />
						</div>
					</section>
				)}

				{probe === undefined ? null : (
					<section mix={[...ctaPadding(), bg("color.neutral.100"), dark(bg("color.neutral.900"))]}>
						<div mix={[...marketingContainer()]}>
							<div
								mix={[
									vstack({ gap: 4, align: "center" }),
									textAlign("center"),
									maxIs("640px"),
									mi("auto"),
								]}
							>
								<span
									mix={[
										inlineFlex(),
										items("center"),
										gap("6px"),
										p("2px", "10px"),
										rounded("999px"),
										fontSize("xs"),
										weight(600),
										bg("brand.tint"),
										fg("brand"),
									]}
								>
									<ActivityIcon size={14} strokeWidth={2} aria-hidden />
									{t("page.trial.cta.badge")}
								</span>
								<Heading level={2} mix={[m(0), fontSize("2xl"), weight(700), tracking("tight")]}>
									{t("page.trial.cta.title")}
								</Heading>
								<Text>{t("page.trial.cta.description", { price })}</Text>
								<div mix={[flex(), flexWrap("wrap"), justify("center"), gap(3), mbs(2)]}>
									<LinkButton href={routes.app.index.href()} size="lg">
										{t("page.trial.cta.action")}
										<ArrowRightIcon size={18} strokeWidth={1.5} aria-hidden />
									</LinkButton>
									<LinkButton
										href={`${routes.home.href()}#pricing`}
										color="neutral"
										variant="outline"
										size="lg"
									>
										{t("page.trial.cta.pricing")}
									</LinkButton>
								</div>
							</div>
						</div>
					</section>
				)}

				{siteKey === null ? null : <script src={TURNSTILE_SCRIPT} async defer />}
			</MarketingLayout>
		</DocumentLayout>,
	);
}

export default createController(routes.trial.check, {
	actions: {
		/**
		 * GET /try — the empty box, plus the receipt for a watch that was just opened. Reaches
		 * nothing that could cost a probe, which is what makes it safe for a crawler, a link
		 * preview, or a reload to land on.
		 */
		index(ctx) {
			let watching = takeTrialState<string>(ctx.get(Session), TRIAL_WATCH_STARTED);

			return renderTrialPage({
				watching,
				prefill: ctx.url.searchParams.get(TRIAL_URL_FIELD) ?? "",
			});
		},

		/**
		 * POST /try — the one free probe an anonymous visitor gets, and the page that reports
		 * it.
		 *
		 * Two halves, in this order and never the other way round. `guardTrialProbe` decides
		 * whether this request may cause an outbound fetch at all — target rules, Turnstile,
		 * the caller's per-minute budget and the site's daily one — and only a grant reaches
		 * `HttpCheck`, which is the same class a paid monitor's scheduled check runs through.
		 *
		 * Nothing here is billed. A trial probe creates no Polar customer, ingests no ping and
		 * records no data point: the visitor has no account to attribute it to and the whole
		 * point of the page is that trying it costs them nothing. The daily budget in the
		 * guard is what bounds what it costs *us*.
		 *
		 * ## Redirects
		 *
		 * `trial-guard.ts` validates the addresses the target's hostname resolves to and
		 * states plainly that redirects are the one thing it cannot cover: a public URL
		 * answering `302 Location: http://169.254.169.254/` sends whoever follows it straight
		 * at cloud instance metadata, long after the guard has finished deciding. So this
		 * probe passes `followRedirects: false`, which is the whole reason that option exists
		 * — every other caller of `HttpCheck` probes a URL its own team configured, where a
		 * redirect leads somewhere that team chose. A 3xx therefore comes back as a 3xx and is
		 * classified as one, which is also the honest thing to show a visitor: their URL
		 * answered, and it answered with a redirect.
		 *
		 * Nothing this handler could do instead would work. Re-checking the final URL
		 * afterwards is too late, because the fetch that mattered has already gone out.
		 */
		async action(ctx) {
			let session = ctx.get(Session);

			let target = ctx.formData.get(TRIAL_URL_FIELD);
			let token = ctx.formData.get(TURNSTILE_FIELD);
			let submitted = typeof target === "string" ? target : "";

			/**
			 * A submission that ends in a refusal must not leave the previous check claimable:
			 * the result is off the screen, so the email form that acts on it is gone too, and
			 * a probe nobody can see is one nobody should be able to post a watch for.
			 */
			session?.unset(TRIAL_PROBE);

			let grant = await guardTrialProbe({
				target: submitted,
				token: typeof token === "string" && token !== "" ? token : null,
				request: ctx.request,
			});

			if (isFailure(grant)) {
				logger.info("trial.probe_refused", {
					reason: grant.error.reason,
					detail: grant.error.detail,
				});

				return renderTrialPage({
					refusal: {
						code: grant.error.reason,
						retryAfterSeconds: grant.error.retryAfterSeconds,
					},
					prefill: submitted,
				});
			}

			let url = grant.data.url.toString();
			/**
			 * The options come from `trialProbeOptions` rather than from here, because the hourly
			 * sweep builds its checks the same way: the number this page shows and the numbers a
			 * digest reports a week later are presented as one measurement, and they stop being
			 * one the moment the two callers drift on a timeout or an expected status.
			 */
			let check = new HttpCheck(trialProbeOptions(url));

			let outcome: HttpProbeOutcome;
			try {
				outcome = await check.probe();
			} catch (error) {
				/**
				 * Only an unreachable Durable Object gets here — a target that refuses, fails DNS
				 * or times out comes back as an outcome, not as a throw. So this is our fault and
				 * is reported as ours; telling the visitor their site is down because our prober
				 * was unavailable would be the page lying about the one thing it exists to say.
				 */
				logger.error("trial.probe_unavailable", {
					message: error instanceof Error ? error.message : String(error),
				});

				return renderTrialPage({
					refusal: { code: "unavailable", retryAfterSeconds: null },
					prefill: url,
				});
			}

			let probe: TrialProbeState = {
				url,
				status: check.classify(outcome, true),
				responseStatus: outcome.responseStatus,
				responseTimeMs: outcome.responseTimeMs,
				location: outcome.location,
				checkedAt: Date.now(),
			};

			/**
			 * Stored even though this response already renders it: the email form under the
			 * result is a second request, and the watch it opens has to be for a URL we resolved
			 * and checked ourselves rather than one posted back up from the browser.
			 */
			session?.set(TRIAL_PROBE, probe);

			return renderTrialPage({ probe });
		},
	},
});
