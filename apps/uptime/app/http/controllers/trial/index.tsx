/**
 * `/try` — the public offer of a free multi-day health report on one site, and the only page
 * in this feature that sells.
 *
 * What the visitor is asking for is a week of evidence about a real site, not a temporary
 * account: the check that runs on submit is the first of the run, and the copy says so
 * everywhere, with the length interpolated from `~/app/lib/pricing` so the page and the
 * emails cannot disagree about how long the offer lasts.
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
 * ## Who is looking at it
 *
 * The page is written for a stranger, and for a stranger nothing about it changes. A
 * signed-in viewer gets two things differently: their check is billed to their team when
 * that team is paying for one (see the `POST` handler), and the email capture under the
 * result is replaced by an offer to monitor the URL properly. Asking somebody with an
 * account for an email address we already hold, in exchange for a weaker version of what
 * they can already have, is the one thing this card must not do.
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
	CheckIcon,
	ClockIcon,
	CreditCardIcon,
	GlobeIcon,
	MailIcon,
	NetworkIcon,
} from "@pkg/lucide-remix";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { bg, fg, linearGradient } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { listStyle } from "@pkg/u/general";
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
import {
	Alert,
	Badge,
	Button,
	Card,
	Checkbox,
	Description,
	FieldError,
	Heading,
	HeadingScope,
	LinkButton,
	Text,
	TextField,
} from "@pkg/ui";
import { generateUUID } from "@pkg/uuid";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";
import { Session } from "remix/session";
import { css } from "remix/ui";

import type { TrialProbeState } from "~/app/http/controllers/trial/session";
import type { HttpProbeOutcome } from "~/app/services/http-check";
import type { TrialRefusalReason } from "~/app/services/trial-guard";
import type { MonitorStatus, SelectTeam } from "~/database/schema";

import Subscription from "~/app/data/subscription";
import Team from "~/app/data/team";
import {
	TRIAL_PROBE,
	TRIAL_WATCH_REPEATED,
	TRIAL_WATCH_STARTED,
	isRedirectProbe,
	takeTrialState,
} from "~/app/http/controllers/trial/session";
import { getViewer } from "~/app/http/middleware/auth";
import { MONITOR_URL_PREFILL } from "~/app/http/validators/monitor";
import { TRIAL_URL_FIELD, TURNSTILE_FIELD } from "~/app/http/validators/trial";
import { BASE_PRICE_USD, FREE_TRIAL_DAYS } from "~/app/lib/pricing";
import { SEO } from "~/app/lib/seo";
import { trialProbeOptions } from "~/app/lib/trial-probe";
import { recordAdhocPing } from "~/app/services/adhoc-ping";
import { apportionCostByTeam } from "~/app/services/cost";
import {
	hostnameOf,
	trackUrlCheckCompleted,
	trackUrlCheckStarted,
} from "~/app/services/funnel-events";
import { HttpCheck } from "~/app/services/http-check";
import { trialTurnstileSiteKey } from "~/app/services/trial-guard";
import { guardTrialProbe } from "~/app/services/trial-guard";
import Turnstile from "~/resources/components/turnstile";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

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
 * A refused submission, as the page needs to explain it.
 *
 * The guard produces every code but one. `unavailable` also arrives from this controller,
 * for the case the guard cannot see: it said yes and the Durable Object that performs the
 * probe could not be reached, so nothing at all was learned about the target. Both faults
 * are the same sentence to a visitor — ours, not yours — which is why they share a code and
 * are told apart only in the logs.
 */
export interface TrialRefusalState {
	code: TrialRefusalReason;
	/**
	 * Seconds until a retry could work, when the refusal knows. Only a rate limit does;
	 * everything else carries `null` and the copy says nothing about waiting.
	 */
	retryAfterSeconds: number | null;
}

/**
 * What a signed-in visitor is offered under their result, in place of the email capture.
 *
 * They already have an account, so a week of free watching in exchange for an address we
 * hold is a worse version of what they can have now. The offer is the real product instead:
 * a monitor on the URL they just checked.
 */
export interface TrialMonitorOffer {
	/** The new-monitor form, with the checked URL already in its field. */
	createHref: string;
	/**
	 * Billing, when this viewer's team holds no active subscription and the monitor they
	 * are about to create would sit unscheduled until it does. `null` when it would run.
	 */
	subscribeHref: string | null;
}

/** Everything that varies between the ways this page can be reached. */
export interface TrialPageView {
	/** The check that ran, when one did. */
	probe?: TrialProbeState;
	/** Why no check ran, when none did. */
	refusal?: TrialRefusalState;
	/** The URL a watch was just opened for, rendered once as a receipt. */
	watching?: string;
	/**
	 * The URL a submission was capped on, rendered once as its own receipt. Set instead of
	 * {@link TrialPageView.watching} when the address already had a free week on that URL
	 * inside the last thirty days, so nothing was started and the report went out instead.
	 */
	repeated?: string;
	/** Whether the address just submitted to the email form failed validation. */
	leadError?: boolean;
	/** Starting value for the URL box, when no probe supplies one. */
	prefill?: string;
	/** The signed-in viewer's offer, which replaces the email capture when present. */
	monitorOffer?: TrialMonitorOffer;
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
 * One function for every reason including {@link isIncompleteForm}'s, even though that one
 * renders somewhere else entirely, so that no reason can acquire a second sentence by
 * being handled in a second place.
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
	if (refusal.code === "challenge-incomplete") return t("page.trial.refusal.challengeIncomplete");
	if (refusal.code === "failed-challenge") return t("page.trial.refusal.failedChallenge");
	if (refusal.code === "budget-exhausted") return t("page.trial.refusal.budgetExhausted");
	return t("page.trial.refusal.unavailable");
}

/**
 * Whether a refusal is the form not being finished rather than the request being turned
 * down.
 *
 * The one refusal the visitor clears by doing something on the page they are already
 * looking at, so it renders where its control is — a field error under the challenge —
 * instead of in the Alert. An Alert titled "The check did not run" over "tick the box" is a
 * misdiagnosis dressed as a failure, and it is also the wrong shape: nothing went wrong.
 *
 * @param refusal - The refusal to place, when there is one.
 * @returns Whether it belongs on the field rather than in the Alert.
 */
function isIncompleteForm(refusal: TrialRefusalState | undefined): boolean {
	return refusal?.code === "challenge-incomplete";
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
	let { probe, refusal, watching, repeated, leadError, monitorOffer } = view;
	let incomplete = isIncompleteForm(refusal);

	let chrome = buildMarketingChrome(t);

	/**
	 * How long the free report runs for. Interpolated into every line that quotes it, so the
	 * page, the emails and the scheduling that actually stops the watch all read the term from
	 * `~/app/lib/pricing` instead of each spelling out a number of their own.
	 */
	let days = FREE_TRIAL_DAYS;

	let prefill = (view.prefill ?? "").slice(0, MAX_PREFILL_LENGTH);
	let redirected = probe !== undefined && isRedirectProbe(probe);

	let checkedAt = probe
		? new Intl.DateTimeFormat(ctx.locale, { dateStyle: "medium", timeStyle: "short" }).format(
				new Date(probe.checkedAt),
			)
		: "";

	let benefits: SellingPoint[] = [
		{
			icon: <ClockIcon size={24} strokeWidth={1.5} />,
			title: t("page.trial.benefits.list.hourly.title"),
			description: t("page.trial.benefits.list.hourly.description", { days }),
		},
		{
			icon: <BellIcon size={24} strokeWidth={1.5} />,
			title: t("page.trial.benefits.list.changes.title"),
			description: t("page.trial.benefits.list.changes.description"),
		},
		{
			icon: <MailIcon size={24} strokeWidth={1.5} />,
			title: t("page.trial.benefits.list.digest.title"),
			description: t("page.trial.benefits.list.digest.description", { days }),
		},
		{
			icon: <CreditCardIcon size={24} strokeWidth={1.5} />,
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
			icon: <NetworkIcon size={24} strokeWidth={1.5} />,
			title: t("page.trial.more.list.tcp.title"),
			description: t("page.trial.more.list.tcp.description"),
		},
		{
			icon: <GlobeIcon size={24} strokeWidth={1.5} />,
			title: t("page.trial.more.list.dns.title"),
			description: t("page.trial.more.list.dns.description"),
		},
		{
			icon: <ClockIcon size={24} strokeWidth={1.5} />,
			title: t("page.trial.more.list.cron.title"),
			description: t("page.trial.more.list.cron.description"),
		},
	];

	/**
	 * What handing over an address actually buys, spelled out before it is asked for: the
	 * address we will keep checking, how often, for how long, which emails arrive, and what is
	 * not required. Every line describes what the run *will* do — none of them counts checks
	 * that have not happened or implies anything about what was found.
	 */
	let expectations =
		probe === undefined
			? []
			: [
					t("page.trial.lead.expectations.target", { url: probe.url }),
					t("page.trial.lead.expectations.cadence", { days }),
					t("page.trial.lead.expectations.emails"),
					t("page.trial.lead.expectations.noAccount"),
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
			title={t("page.trial.meta.title", { days })}
			locale={ctx.locale}
			seo={{
				description: t("page.trial.meta.description", { days }),
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
								{t("page.trial.heading", { days })}
							</Heading>
							{probe !== undefined ? null : (
								<p mix={[m(0), maxIs("560px"), fontSize("sm"), leading(1.6), fg("neutral")]}>
									{t("page.trial.intro", { days })}
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

										<div mix={[vstack({ gap: 2 })]}>
											<Turnstile siteKey={trialTurnstileSiteKey()} />
											{/*
											 * The unfinished-form refusal renders here rather than in the
											 * Alert below, against the control it is about, in the same
											 * `FieldError` the URL box's own validation message uses.
											 */}
											{refusal !== undefined && incomplete ? (
												<FieldError>{refusalMessage(refusal, t)}</FieldError>
											) : null}
										</div>

										{/*
										 * Inside the card and against the button that produced it. Below the
										 * card, which is where this used to sit, it read as a notice about the
										 * page rather than as the answer to the submit that just failed.
										 */}
										{refusal === undefined || incomplete ? null : (
											<Alert color="warning" live="polite">
												<Alert.Content>
													<Alert.Title>{t("page.trial.refusal.title")}</Alert.Title>
													<Alert.Description>{refusalMessage(refusal, t)}</Alert.Description>
												</Alert.Content>
											</Alert>
										)}

										<Button type="submit" size="lg">
											{t("page.trial.form.submit")}
										</Button>
									</form>
								</Card.Content>
							</Card>
						)}

						{watching === undefined ? null : (
							<Alert color="success" live="polite" mix={[mbs(6)]}>
								<Alert.Content>
									<Alert.Title>{t("page.trial.watching.title")}</Alert.Title>
									<Alert.Description>
										{t("page.trial.watching.description", { url: watching, days })}
									</Alert.Description>
								</Alert.Content>
							</Alert>
						)}

						{/*
						 * Not `success`, because nothing was started, and not `warning`, because
						 * nothing went wrong either: the URL is already being reported on and the
						 * report is on its way. `brand` is the tone the page uses for the thing it
						 * is telling you rather than the thing you did.
						 */}
						{repeated === undefined ? null : (
							<Alert color="brand" live="polite" mix={[mbs(6)]}>
								<Alert.Content>
									<Alert.Title>{t("page.trial.repeated.title")}</Alert.Title>
									<Alert.Description>
										{t("page.trial.repeated.description", { url: repeated })}
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
										) : monitorOffer !== undefined ? (
											<div mix={[vstack({ gap: 4 })]}>
												<div mix={[vstack({ gap: 2 })]}>
													<Heading level={3} mix={[m(0), fontSize("base")]}>
														{t("page.trial.monitor.title")}
													</Heading>
													<Text>
														{monitorOffer.subscribeHref === null
															? t("page.trial.monitor.description")
															: t("page.trial.monitor.subscribeDescription")}
													</Text>
												</div>

												{/* Stacked and full-width rather than a wrapping row: side by side, the
												    two read as equal choices, when subscribing is the one that makes the
												    monitor keep running. */}
												<div mix={[vstack({ gap: 3 })]}>
													<LinkButton
														href={monitorOffer.createHref}
														mix={[is("full"), justify("center")]}
													>
														{t("page.trial.monitor.create")}
														<ArrowRightIcon size={18} strokeWidth={1.5} />
													</LinkButton>
													{monitorOffer.subscribeHref === null ? null : (
														<LinkButton
															href={monitorOffer.subscribeHref}
															color="neutral"
															variant="outline"
															mix={[is("full"), justify("center")]}
														>
															{t("page.trial.monitor.subscribe")}
														</LinkButton>
													)}
												</div>
											</div>
										) : (
											<div mix={[vstack({ gap: 6 })]}>
												<div mix={[vstack({ gap: 3 })]}>
													<Heading level={3} mix={[m(0), fontSize("base")]}>
														{t("page.trial.lead.title", { days })}
													</Heading>
													<Text>{t("page.trial.lead.description", { days })}</Text>

													{/*
													 * The terms of the offer, above the field that accepts them rather
													 * than under the button that submits it: what we will check, how
													 * often, for how long, what arrives by email, and what is not being
													 * asked for. A list and not a paragraph because it is scanned, and
													 * `listStyle("none")` with a check per row because the marker is
													 * carrying no meaning the icon does not.
													 */}
													<ul
														mix={[
															m(0),
															p(0),
															listStyle("none"),
															grid(),
															gap(2),
															fontSize("sm"),
															leading(1.5),
															fg("neutral"),
														]}
													>
														{expectations.map((item) => (
															<li key={item} mix={[flex(), items("start"), gap(2)]}>
																<CheckIcon
																	size={16}
																	strokeWidth={2}
																	mix={[fg("brand"), mbs("2px")]}
																/>
																<span mix={[wordBreak("break-word")]}>{item}</span>
															</li>
														))}
													</ul>
												</div>

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
														<Checkbox
															name="consent"
															value="true"
															aria-describedby={CONSENT_NOTE_ID}
														>
															<span mix={[fontSize("sm")]}>{t("page.trial.lead.consent")}</span>
														</Checkbox>
														<Description id={CONSENT_NOTE_ID} mix={[pis(CHECKBOX_LABEL_OFFSET)]}>
															{t("page.trial.lead.consentNote")}
														</Description>
													</div>

													<Description>{t("page.trial.lead.promise")}</Description>

													<Button type="submit">{t("page.trial.lead.submit", { days })}</Button>
												</form>
											</div>
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

				{/* The free week is what an anonymous visitor is being offered, so it is sold
				    only to one. A signed-in reader was offered a monitor instead, and pitching
				    them a trial that ends on "no account, no card" describes neither what they
				    were just offered nor what they already have. */}
				{probe === undefined || monitorOffer !== undefined ? null : (
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
								<Text>{t("page.trial.benefits.description", { days })}</Text>
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
									<ActivityIcon size={14} strokeWidth={2} />
									{t("page.trial.cta.badge")}
								</span>
								{/*
								 * The offer's continuity is the whole argument, so it is the heading and not a
								 * line inside the paragraph: what is on sale is the same watching carrying on
								 * at a shorter interval, not a second thing that starts from nothing.
								 */}
								<Heading level={2} mix={[m(0), fontSize("2xl"), weight(700), tracking("tight")]}>
									{t("page.trial.cta.title", { price })}
								</Heading>
								<Text>{t("page.trial.cta.description", { price, days })}</Text>
								<div mix={[flex(), flexWrap("wrap"), justify("center"), gap(3), mbs(2)]}>
									<LinkButton href={routes.app.index.href()} size="lg">
										{t("page.trial.cta.action")}
										<ArrowRightIcon size={18} strokeWidth={1.5} />
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
			</MarketingLayout>
		</DocumentLayout>,
	);
}

/** The signed-in viewer's standing, as this page needs it. */
interface TrialAccount {
	/**
	 * The team the viewer's work is attributed to: their first, the same one `/app` sends
	 * them to. `null` for a viewer with no membership at all, which signing in makes
	 * impossible but which this page will not crash over.
	 */
	team: SelectTeam | null;
	/**
	 * The team to charge this check to, or `null` when there is nobody to charge — a
	 * subscription known to be inactive, or no team. Non-null implies {@link team}.
	 */
	billedTeam: SelectTeam | null;
}

/**
 * Resolves who is asking, and whether their check can be billed.
 *
 * Answers `null` for an anonymous visitor without touching the database, which is what
 * keeps the free path exactly as cheap as it was before this page knew about accounts.
 *
 * @returns The viewer's standing, or `null` when nobody is signed in.
 */
async function resolveTrialAccount(): Promise<TrialAccount | null> {
	let viewer = getViewer();
	if (viewer === null) return null;

	let db = getServiceContainer().get(Database);
	let [team] = await Team.listBySubjectId(db, viewer.id);
	if (team === undefined) return { team: null, billedTeam: null };

	/**
	 * `stateFor`, not `isActive`: only a subscription *known* to be inactive drops the
	 * viewer onto the free path. An owner whose state cannot be determined keeps being
	 * billed, the same reading every other gate in this app takes, because the alternative
	 * is a lookup blip quietly spending the public daily budget on a paying customer.
	 */
	let state = await Subscription.stateFor(db, team.owner_id);
	return { team, billedTeam: state === "inactive" ? null : team };
}

/**
 * The offer that replaces the email capture for a signed-in viewer.
 *
 * A link to the existing new-monitor form with the URL already in it, rather than a
 * one-click create: a viewer can belong to several teams, and that form is where the
 * interval, the region and the expected status get decided. Building a second way to
 * create a monitor to save one page load would be the expensive kind of shortcut.
 *
 * @param account - The viewer's standing, or `null` when nobody is signed in.
 * @param url - The URL that was just checked, as the guard normalized it.
 * @returns The offer, or `undefined` when the email capture should render instead.
 */
function buildMonitorOffer(
	account: TrialAccount | null,
	url: string,
): TrialMonitorOffer | undefined {
	if (account === null) return undefined;
	// No team means no team-scoped URL to link to; `/app` resolves one, or explains why not.
	if (account.team === null) return { createHref: routes.app.index.href(), subscribeHref: null };

	let team = account.team.slug;
	let query = new URLSearchParams({ [MONITOR_URL_PREFILL]: url });

	return {
		createHref: `${routes.app.team.monitors.new.href({ team })}?${query}`,
		/**
		 * Billing is offered alongside, not instead: the monitor can be created either way,
		 * and it simply will not be scheduled until the subscription is. `checkout` is the
		 * app's one entry point to that — it decides between a Polar checkout and the
		 * customer portal itself, so this page does not have to know which one applies.
		 */
		subscribeHref: account.billedTeam === null ? routes.app.team.checkout.href({ team }) : null,
	};
}

export default createController(routes.trial.check, {
	actions: {
		/**
		 * GET /try — the empty box, plus the receipt for whichever of the two things the last
		 * submission did: opened a watch, or found the URL already had one. Reaches nothing
		 * that could cost a probe, which is what makes it safe for a crawler, a link preview,
		 * or a reload to land on.
		 *
		 * Both receipts are taken even though at most one is ever set, so a value left behind
		 * by an abandoned submission cannot surface on top of the next one's answer.
		 */
		index(ctx) {
			let session = ctx.get(Session);
			let watching = takeTrialState<string>(session, TRIAL_WATCH_STARTED);
			let repeated = takeTrialState<string>(session, TRIAL_WATCH_REPEATED);

			return renderTrialPage({
				watching,
				repeated,
				prefill: ctx.url.searchParams.get(TRIAL_URL_FIELD) ?? "",
			});
		},

		/**
		 * POST /try — the check, and the page that reports it.
		 *
		 * Two halves, in this order and never the other way round. `guardTrialProbe` decides
		 * whether this request may cause an outbound fetch at all — target rules, Turnstile,
		 * the caller's per-minute budget and the site's daily one — and only a grant reaches
		 * `HttpCheck`, which is the same class a paid monitor's scheduled check runs through.
		 *
		 * ## Who pays
		 *
		 * An anonymous check is free and stays free: no Polar customer, no meter event, no
		 * data point, and the guard's two budgets are what bound what it costs *us*.
		 *
		 * A check asked for by a signed-in viewer whose team holds a subscription is the same
		 * work the ad-hoc ping endpoint sells, so it is recorded and billed the same way,
		 * through {@link recordAdhocPing} and `apportionCostByTeam`. Because it is paid for,
		 * it also spends neither free budget and skips the challenge — see `trial-guard.ts` on
		 * why those three and not the SSRF controls.
		 *
		 * A signed-in viewer whose team's subscription is *known* to be inactive gets the free
		 * anonymous treatment for the check itself, budgets and challenge included: there is
		 * nobody to bill, and this page's whole purpose is to be usable by somebody who has
		 * not paid yet. `stateFor` rather than `isActive` is what makes that hinge on a known
		 * "inactive" instead of on a lookup that merely came back empty — a transient failure
		 * must not quietly move a paying customer onto the free budget.
		 *
		 * What no signed-in viewer gets is the email capture; see {@link TrialMonitorOffer}.
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

			let account = await resolveTrialAccount();
			let billedTeam = account?.billedTeam ?? null;

			if (billedTeam !== null) {
				/** Everything this request costs belongs to the team being billed (ADR-007 §5). */
				apportionCostByTeam([billedTeam.id]);
			}

			let grant = await guardTrialProbe({
				target: submitted,
				token: typeof token === "string" && token !== "" ? token : null,
				request: ctx.request,
				billed: billedTeam !== null,
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
			 * Recorded here rather than before the guard, so a blocked target, a failed challenge
			 * or an exhausted budget is a refusal and not a started check — the pair of counts is
			 * meant to measure probes that ran against probes that answered, and folding refusals
			 * into the first would make every guard tightening look like a drop in completion.
			 */
			trackUrlCheckStarted(ctx.logger, {
				hostname: hostnameOf(url),
				sourcePage: ctx.url.pathname,
				signedIn: account !== null,
			});
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

			trackUrlCheckCompleted(ctx.logger, {
				hostname: hostnameOf(url),
				sourcePage: ctx.url.pathname,
				signedIn: account !== null,
				status: probe.status,
				succeeded: probe.status === "up",
				responseTimeMs: probe.responseTimeMs,
			});

			if (billedTeam !== null) {
				recordAdhocPing({
					id: generateUUID(),
					team: billedTeam,
					status: probe.status,
					responseTimeMs: outcome.responseTimeMs ?? 0,
				});
			}

			/**
			 * Stored even though this response already renders it: the email form under the
			 * result is a second request, and the watch it opens has to be for a URL we resolved
			 * and checked ourselves rather than one posted back up from the browser.
			 *
			 * A signed-in viewer never sees that form, so there is nothing for them to claim
			 * and nothing to store — the probe would sit in the session until it was overwritten
			 * or the session expired, claimable only by a request that cannot reach it.
			 */
			if (account === null) session?.set(TRIAL_PROBE, probe);

			return renderTrialPage({ probe, monitorOffer: buildMonitorOffer(account, url) });
		},
	},
});
