/**
 * `/try` — the public offer of a free multi-day health report on one site, and the
 * only page in this feature that sells. `GET` renders the empty URL box; `POST` runs
 * the check and re-renders the same page with the result, so no state has to survive
 * between requests and a reload never shows a stale answer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";
import type { Handle, RemixNode } from "remix/ui";

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
} from "@sdxc/icons";
import { logger } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";
import { getServiceContainer } from "@sdxc/service-container";
import { bg, fg, linearGradient } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { listStyle } from "@sdxc/u/general";
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
} from "@sdxc/u/layout";
import { dark, media } from "@sdxc/u/responsive";
import { bs, is, m, maxIs, mbs, mi, minBs, p, pb, pbe, pbs, pi, pis } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import {
	fontSize,
	leading,
	lineClamp,
	textAlign,
	textDecoration,
	tracking,
	weight,
	wordBreak,
} from "@sdxc/u/typography";
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
} from "@sdxc/ui";
import { generateUUID } from "@sdxc/uuid";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";
import { Session } from "remix/session";

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
 * How many lines of URL the result card's heading shows before clamping. The clamp
 * is visual only: the full URL stays the heading's text, announced, selectable, and
 * copied whole.
 */
const TITLE_MAX_LINES = 3;

/**
 * Inline-start offset that lines a checkbox's description up with its label text rather
 * than with the glyph: `Checkbox`'s 1.25rem box plus the 0.5rem gap of the row it sits in.
 */
const CHECKBOX_LABEL_OFFSET = "1.75rem";

/**
 * Height of `MarketingLayout`'s sticky header, measured from the rendered page. The
 * layout exposes no custom property for it, so this is the only place the number
 * lives; a stale value only costs a few pixels of screen, never a broken layout.
 */
const HEADER_BLOCK_SIZE = "65px";

/**
 * How much of whatever comes next stays on screen when the page is nothing but a form.
 * Enough to say the page continues, not enough to compete with the one field on it.
 */
const FIRST_SCREEN_PEEK = "72px";

/**
 * `dvh` tracks the viewport with the browser chrome retracted, so the block always
 * fits the visible screen on a phone. The minimum lets a small screen's overflowing
 * content grow the section past it, keeping the form fully visible.
 */
const FIRST_SCREEN_MIN_BLOCK_SIZE = `calc(100dvh - ${HEADER_BLOCK_SIZE} - ${FIRST_SCREEN_PEEK})`;

/**
 * A refused submission, as the page needs to explain it. The guard produces every
 * code but one: `unavailable` covers the Durable Object being unreachable, which
 * reads to a visitor as the same "ours, not yours" sentence as every other code.
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
 * What a signed-in visitor is offered under their result, in place of the email
 * capture: a monitor on the URL they just checked, since an address they already
 * gave us in exchange for a weaker version of what they can have now buys nothing.
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
 * Vertical rhythm for the selling sections, each of which follows a section that
 * already ends with its own bottom padding. Each section here owns only the space
 * below it, so two neighbours never stack a full gap into a dead band.
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
 * The card grid both selling sections are built from, so the four benefits of the
 * week and the three things it cannot show read as one design. `auto-fit` serves
 * both card counts at the same container width and collapses on its own as it narrows.
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
 * The result badge, scaled up from `Badge`'s caption-sized default: it is the
 * payload of the whole page, the one thing the visitor came to be told, and the
 * default `xs` size read as a label rather than as the answer.
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
 * The sentence a refusal is explained with. Every reason gets its own sentence,
 * because collapsing them would blur facts a visitor needs told apart, and only
 * the rate limit's copy mentions waiting, since it is the one that knows when.
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
 * Whether a refusal means the form needs finishing, not the request being turned
 * down: the visitor clears it by ticking the box already on the page, so it renders
 * as a field error under the challenge instead of a page-level Alert.
 *
 * @param refusal - The refusal to place, when there is one.
 * @returns Whether it belongs on the field rather than in the Alert.
 */
function isIncompleteForm(refusal: TrialRefusalState | undefined): boolean {
	return refusal?.code === "challenge-incomplete";
}

/**
 * Renders `/try`, in whichever of its states the caller reached. The single code
 * path both methods answer through: the `GET` passes no result, the `POST` passes
 * what it got, and `POST /try/lead` passes the probe back with its form's error.
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
	 * What handing over an address actually buys, spelled out before it is asked for:
	 * the address checked, how often, for how long, which emails arrive, and that no
	 * account is needed — each line states only what the run will do.
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
	 * With nothing to report, the page is one field and a button, given the full
	 * screen and centred in it. Once a check has run the floor drops, so the answer
	 * sits where the visitor came back for it instead of behind empty space.
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
											{refusal !== undefined && incomplete ? (
												<FieldError>{refusalMessage(refusal, t)}</FieldError>
											) : null}
										</div>

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
															data-rmx-document=""
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
	 * `stateFor`, not `isActive`: only a subscription *known* to be inactive drops
	 * the viewer onto the free path. An owner whose state cannot be determined
	 * keeps being billed, because a lookup blip must not quietly spend the public daily budget on a paying customer.
	 */
	let state = await Subscription.stateFor(db, team.owner_id);
	return { team, billedTeam: state === "inactive" ? null : team };
}

/**
 * The offer that replaces the email capture for a signed-in viewer: a link to the
 * existing new-monitor form with the URL already filled in, since that form is
 * where the interval, region, and expected status get decided per team.
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
	if (account.team === null) return { createHref: routes.app.index.href(), subscribeHref: null };

	let team = account.team.slug;
	let query = new URLSearchParams({ [MONITOR_URL_PREFILL]: url });

	return {
		createHref: `${routes.app.team.monitors.new.href({ team })}?${query}`,
		/**
		 * The monitor can be created regardless; it simply waits to be scheduled until the
		 * subscription exists. `checkout` is the app's one entry point for that decision —
		 * it picks between a Polar checkout and the customer portal on its own.
		 */
		subscribeHref: account.billedTeam === null ? routes.app.team.checkout.href({ team }) : null,
	};
}

export default createController(routes.trial.check, {
	actions: {
		/**
		 * GET /try — the empty box, plus the receipt for whichever of the last submission's
		 * two outcomes applies: a watch opened, or the URL already had one. Reaches nothing
		 * that could cost a probe, so a crawler, a link preview, or a reload can safely land here.
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
		 * POST /try — runs `guardTrialProbe` before any outbound fetch, then `HttpCheck` in
		 * `followRedirects: false` mode, since a redirect can only be safely evaluated by
		 * the caller that requested it and never automatically followed past the guard.
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
			 * Recorded here rather than before the guard, so a refusal — blocked target, failed
			 * challenge, or exhausted budget — never counts as a started check: the two counts
			 * measure probes that ran against probes that answered.
			 */
			trackUrlCheckStarted(ctx.logger, {
				hostname: hostnameOf(url),
				sourcePage: ctx.url.pathname,
				signedIn: account !== null,
			});
			/**
			 * Options come from `trialProbeOptions`, the same builder the hourly sweep uses, so
			 * the number this page shows and the number a digest reports later are one
			 * measurement instead of two that can drift on a timeout or an expected status.
			 */
			let check = new HttpCheck(trialProbeOptions(url));

			let outcome: HttpProbeOutcome;
			try {
				outcome = await check.probe();
			} catch (error) {
				/**
				 * Only an unreachable Durable Object reaches this catch — a target that refuses,
				 * fails DNS, or times out comes back as an outcome. This fault is ours, so it is
				 * reported as ours rather than telling the visitor their site is down.
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
				recordAdhocPing(ctx.billing, {
					id: generateUUID(),
					team: billedTeam,
					status: probe.status,
					responseTimeMs: outcome.responseTimeMs ?? 0,
				});
			}

			/**
			 * Stored even though this response already renders it: the email form under the
			 * result is a second request, and the watch it opens must target the URL this
			 * request resolved and checked, not one posted back up from the browser.
			 */
			if (account === null) session?.set(TRIAL_PROBE, probe);

			return renderTrialPage({ probe, monitorOffer: buildMonitorOffer(account, url) });
		},
	},
});
