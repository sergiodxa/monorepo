/**
 * `GET /try/report/:token` — the seven-day health report as a page.
 *
 * The report already existed as an email. A page is what makes it an artifact: something a
 * reader can come back to, forward to a colleague or a client, and arrive at from the email
 * days later — and something a conversion call to action can live on once the trial is over
 * and the inbox has moved on.
 *
 * Addressed by the watch's own `report_token` and nothing else, because there is no account
 * behind a trial and the URL is therefore the only credential available. That token is
 * deliberately not the lead's unsubscribe token: this link is meant to be shared, and sharing
 * it must never hand somebody the power to delete the reader's address.
 *
 * ## Every figure is computed, and a figure with no data behind it is not printed
 *
 * The percentages and counts come from the watch's own totals through `watchStats`, and the
 * incidents from the stored results through `incidentsFrom` — the same functions the emails
 * use, so a reader holding both cannot be shown two versions of one week. Where there is
 * nothing to report the page says so rather than rounding to a flattering zero: a watch whose
 * checks have not started yet shows an em dash and a sentence explaining why, and it does not
 * claim "no incidents", because nobody has looked yet. A week that genuinely had no failure
 * does say so plainly, in one sentence, which is the whole of what the data supports.
 *
 * No incident duration is stated anywhere. Checks are an hour apart, so "down for three hours"
 * would be an assertion about fifty-nine unobserved minutes per check; the page names when a
 * failure was first seen and how many consecutive checks failed.
 *
 * There is no certificate section. The trial probes over HTTP and records a status, a response
 * time and an instant — no certificate is inspected and no expiry is stored anywhere a watch
 * can reach — so an expiry panel here could only be a guess, and the section is absent rather
 * than approximated.
 *
 * ## It is not indexable
 *
 * The page is about one reader's own site and is reachable only by an unguessable token, so it
 * emits `noindex, nofollow`. A crawler that somehow obtained a link must not put it in an
 * index where the token becomes searchable, and following the links out of it serves nobody.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@pkg/i18n";

import { formatDate, formatDateTime } from "@pkg/dates";
import { notFound } from "@pkg/http/response/html";
import { Card, Heading, HeadingScope, LinkButton, Text } from "@pkg/r3-ui";
import { getServiceContainer } from "@pkg/service-container";
import { bg, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { raw } from "@pkg/u/general";
import { grid, gridTemplate, hstack, vstack } from "@pkg/u/layout";
import { media } from "@pkg/u/responsive";
import { bs, m, maxIs, mi, minIs, p, pbe, pbs, pi } from "@pkg/u/size";
import { fontSize, leading, textAlign, weight, wordBreak } from "@pkg/u/typography";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import type { UptimeBar } from "~/app/emails/shared/uptime-bar";
import type { TrialIncident } from "~/app/lib/trial-report";
import type { SelectTrialWatch, SelectTrialWatchResult } from "~/database/schema";

import TrialWatch, { TRIAL_WATCH_DURATION_DAYS } from "~/app/data/trial-watch";
import { BASE_PRICE_USD, formatUsd } from "~/app/lib/pricing";
import { SEO } from "~/app/lib/seo";
import { incidentsFrom, segmentsOver, watchStats } from "~/app/lib/trial-report";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/** The one path param, read through a schema the way every other controller reads one. */
const ParamsSchema = s.object({ token: s.string() });

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * What a figure reads as when there is no data behind it. An em dash and never `0`: a zero is
 * a measurement, and printing one for a week nothing answered in would be the page's only lie.
 */
const NO_DATA = "—";

/**
 * The zone every instant on the page is rendered in, named in the copy beside them.
 *
 * A trial reader is an email address and nothing else — no account, so no stored timezone and
 * no settings page to pick one in — which is the same reason the trial emails render in UTC.
 * Naming the zone is what keeps a timestamp honest for a reader who is four hours off it.
 */
const REPORT_ZONE = "UTC";

/** One labelled figure in a card's row of them. */
interface Figure {
	label: string;
	value: string;
}

/**
 * The window the report covers: the watch's whole seven days, or as much of them as has
 * actually happened when the reader arrives mid-trial.
 *
 * Clamped at `now` rather than always ending at `expires_at`, because a period ending in the
 * future would describe checks that have not run as though they had.
 */
function reportPeriod(watch: SelectTrialWatch, now: number) {
	return { from: watch.created_at, to: Math.min(now, watch.expires_at) };
}

/**
 * The response-time figures, or `null` when nothing ever answered.
 *
 * Derived from the checks that carry a timing and not from every check: a target that was
 * unreachable records no duration, and folding those in as zeros would report a site that was
 * down as instantaneous.
 */
function timingSummary(results: SelectTrialWatchResult[]) {
	let timings = results.flatMap((result) =>
		result.response_time_ms === null ? [] : [result.response_time_ms],
	);

	if (timings.length === 0) return null;

	let total = timings.reduce((sum, timing) => sum + timing, 0);

	return {
		answered: timings.length,
		fastest: Math.min(...timings),
		slowest: Math.max(...timings),
		average: Math.round(total / timings.length),
	};
}

/**
 * The uptime ratio as the reader's own locale writes a percentage.
 *
 * The digits come from `watchStats`, so they are the same digits the emails print; only the
 * symbol and its placement are added here, and they are added by `Intl` rather than by a
 * locale key because where a percent sign goes is locale *data* and not copy somebody should
 * have to translate.
 *
 * @param uptime - A `watchStats` percentage, e.g. `"98.8"`.
 * @param locale - The request's language.
 * @returns The percentage as text, e.g. `"98.8%"`.
 */
function formatPercent(uptime: string, locale: string): string {
	return new Intl.NumberFormat(locale, {
		style: "percent",
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	}).format(Number(uptime) / 100);
}

/**
 * A duration as the reader's locale writes milliseconds, for the same reason
 * {@link formatPercent} formats its own unit: the unit is data, and grouping a four-digit
 * timing is what stops `1980ms` reading as a different order of magnitude than it is.
 */
function formatMs(ms: number, locale: string): string {
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "millisecond",
		unitDisplay: "short",
	}).format(ms);
}

/** The fill one day of the bar takes, including the day no check covered. */
function segmentFill(status: UptimeBar.Status) {
	if (status === "up") return bg("success.solid");
	if (status === "degraded") return bg("warning.solid");
	if (status === "down") return bg("danger.solid");
	return bg("neutral.border");
}

/** The locale key naming what one day of the bar reports, `noData` included. */
function segmentLabelKey(status: UptimeBar.Status) {
	return `page.trial.report.bar.status.${status ?? "noData"}`;
}

/**
 * One incident as a sentence: when the first failure was seen and how many consecutive checks
 * failed. No duration — see the module comment for why that number does not exist.
 */
function incidentLine(incident: TrialIncident, locale: string, t: TFunction) {
	return t("page.trial.report.incidents.entry", {
		started: formatDateTime(new Date(incident.startedAt), { locale, timeZone: REPORT_ZONE }),
		// `count`, so the sentence can decline "one check" against "four checks" in every
		// language rather than in the one it was written in.
		count: incident.checks,
	});
}

/** GET /try/report/:token — one trial target's health report. */
export default createAction(routes.trial.report, async (ctx) => {
	let { token } = s.parse(ParamsSchema, ctx.params);
	let t = ctx.i18next.t;
	let locale = ctx.locale;

	let db = getServiceContainer().get(Database);
	let watch = await TrialWatch.findByReportToken(db, token);

	/**
	 * A token this database never issued and one whose watch has since been swept are the same
	 * answer. There is nothing to report either way, and distinguishing them would turn the URL
	 * into a way of finding out whether a guessed token is live.
	 */
	if (!watch) return notFound("Not Found");

	let now = Date.now();
	let period = reportPeriod(watch, now);
	let results = await TrialWatch.listResultsBetween(db, watch.id, period.from, watch.expires_at);

	let stats = watchStats(watch);
	let incidents = incidentsFrom(results);
	let timings = timingSummary(results);
	let segments = segmentsOver(results, watch.created_at, MS_PER_DAY, TRIAL_WATCH_DURATION_DAYS);

	/**
	 * Whether anything has been measured at all. Every "nothing went wrong" statement on the
	 * page is gated on this: with no completed check an empty incident list means nobody has
	 * looked yet, not that the target stayed up.
	 */
	let measured = stats.checks > 0;

	let chrome = buildMarketingChrome(t);

	let headlineFigures: Figure[] = [
		{
			label: t("page.trial.report.summary.uptime"),
			value: stats.uptime === null ? NO_DATA : formatPercent(stats.uptime, locale),
		},
		{
			label: t("page.trial.report.summary.checks"),
			value: measured ? String(stats.checks) : NO_DATA,
		},
		{
			label: t("page.trial.report.summary.healthy"),
			value: measured ? String(watch.checks_ok) : NO_DATA,
		},
	];

	let timingFigures: Figure[] =
		timings === null
			? []
			: [
					{
						label: t("page.trial.report.timing.fastest"),
						value: formatMs(timings.fastest, locale),
					},
					{
						label: t("page.trial.report.timing.average"),
						value: formatMs(timings.average, locale),
					},
					{
						label: t("page.trial.report.timing.slowest"),
						value: formatMs(timings.slowest, locale),
					},
				];

	/**
	 * Which of the three things the closing card is allowed to say. A converted target is
	 * already monitored and must not be sold again; an attempt past its own `converts_until`
	 * may still be sold, but the promise that its history carries over is no longer true.
	 */
	let offer =
		watch.converted_at !== null
			? "converted"
			: TrialWatch.isConvertible(watch, now)
				? "convertible"
				: "expired";

	return ctx.render(
		<DocumentLayout
			title={t("page.trial.report.meta.title", { days: TRIAL_WATCH_DURATION_DAYS })}
			locale={locale}
			seo={{
				description: t("page.trial.report.meta.description"),
				canonical: SEO.canonical(ctx.url),
				/**
				 * The one page on the site that must never be indexed: it is the record of somebody's
				 * own site, behind a token that would become searchable the moment a crawler stored
				 * the URL it is part of.
				 */
				robots: SEO.robotsTag({ index: false, follow: false }),
			}}
		>
			<MarketingLayout isSignedIn={false} {...chrome}>
				<section mix={[pbs(12), pbe(12)]}>
					<div
						mix={[
							maxIs("720px"),
							mi("auto"),
							pi(4),
							media("(min-width: 640px)", pi(6)),
							vstack({ gap: 6 }),
						]}
					>
						<div mix={[vstack({ gap: 2 })]}>
							<Text mix={[fontSize("xs"), fg("neutral.muted")]}>
								{t("page.trial.report.eyebrow", { days: TRIAL_WATCH_DURATION_DAYS })}
							</Text>
							<Heading
								level={1}
								mix={[m(0), fontSize("2xl"), weight(700), leading(1.15), wordBreak("break-all")]}
							>
								{watch.url}
							</Heading>
							<Text mix={[fontSize("sm"), fg("neutral")]}>
								{t("page.trial.report.period", {
									start: formatDate(new Date(period.from), { locale, timeZone: REPORT_ZONE }),
									end: formatDate(new Date(period.to), { locale, timeZone: REPORT_ZONE }),
									zone: REPORT_ZONE,
								})}
							</Text>
						</div>

						<HeadingScope level={2}>
							<Card>
								<Card.Header>
									<Card.Title>{t("page.trial.report.summary.title")}</Card.Title>
								</Card.Header>
								<Card.Content mix={[vstack({ gap: 6 })]}>
									<div mix={[vstack({ gap: 2 })]}>
										<div mix={[hstack({ align: "stretch", gap: "4px" }), bs("32px")]}>
											{segments.map((status, day) => (
												<div
													key={`day-${day}`}
													title={t(segmentLabelKey(status))}
													mix={[
														raw({ flex: 1 }),
														minIs("2px"),
														rounded("2px"),
														segmentFill(status),
													]}
												/>
											))}
										</div>
										<Text mix={[fontSize("xs"), fg("neutral.muted")]}>
											{t("page.trial.report.bar.caption", { days: TRIAL_WATCH_DURATION_DAYS })}
										</Text>
									</div>

									<dl
										mix={[
											m(0),
											grid(),
											gridTemplate({ columns: "repeat(3, minmax(0, 1fr))" }),
											media("(max-width: 480px)", gridTemplate({ columns: "1fr" })),
										]}
									>
										{headlineFigures.map((figure) => (
											<div key={figure.label} mix={[vstack({ gap: 1 })]}>
												<dt mix={[fontSize("xs"), fg("neutral.muted")]}>{figure.label}</dt>
												<dd mix={[m(0), fontSize("xl"), weight(700)]}>{figure.value}</dd>
											</div>
										))}
									</dl>

									{measured ? null : (
										<Text mix={[fontSize("sm"), fg("neutral")]}>
											{t("page.trial.report.summary.noChecks")}
										</Text>
									)}
								</Card.Content>
							</Card>

							<Card>
								<Card.Header>
									<Card.Title>{t("page.trial.report.incidents.title")}</Card.Title>
								</Card.Header>
								<Card.Content mix={[vstack({ gap: 3 })]}>
									{!measured ? (
										<Text>{t("page.trial.report.incidents.unknown")}</Text>
									) : incidents.length === 0 ? (
										<Text>{t("page.trial.report.incidents.none", { count: stats.checks })}</Text>
									) : (
										<>
											<Text>
												{t("page.trial.report.incidents.summary", { count: incidents.length })}
											</Text>
											<ul mix={[m(0), pi(0), vstack({ gap: 2 }), raw({ listStyle: "none" })]}>
												{incidents.map((incident) => (
													<li key={incident.startedAt} mix={[fontSize("sm")]}>
														{incidentLine(incident, locale, t)}
													</li>
												))}
											</ul>
										</>
									)}
								</Card.Content>
							</Card>

							{timings === null ? null : (
								<Card>
									<Card.Header>
										<Card.Title>{t("page.trial.report.timing.title")}</Card.Title>
									</Card.Header>
									<Card.Content mix={[vstack({ gap: 3 })]}>
										<dl
											mix={[
												m(0),
												grid(),
												gridTemplate({ columns: "repeat(3, minmax(0, 1fr))" }),
												media("(max-width: 480px)", gridTemplate({ columns: "1fr" })),
											]}
										>
											{timingFigures.map((figure) => (
												<div key={figure.label} mix={[vstack({ gap: 1 })]}>
													<dt mix={[fontSize("xs"), fg("neutral.muted")]}>{figure.label}</dt>
													<dd mix={[m(0), fontSize("xl"), weight(700)]}>{figure.value}</dd>
												</div>
											))}
										</dl>
										<Text mix={[fontSize("xs"), fg("neutral.muted")]}>
											{/* `count`, so the sentence declines "the one check" against "the 4 checks". */}
											{t("page.trial.report.timing.basis", { count: timings.answered })}
										</Text>
									</Card.Content>
								</Card>
							)}

							<Card mix={[bg("brand.bg-tint")]}>
								<Card.Content
									mix={[vstack({ gap: 4, align: "center" }), textAlign("center"), p(8)]}
								>
									<Heading level={2} mix={[m(0), fontSize("xl"), weight(700)]}>
										{offer === "converted"
											? t("page.trial.report.cta.converted.title")
											: t("page.trial.report.cta.title", { price: formatUsd(BASE_PRICE_USD) })}
									</Heading>
									<Text mix={[fontSize("sm"), fg("neutral")]}>
										{offer === "converted"
											? t("page.trial.report.cta.converted.body")
											: offer === "convertible"
												? t("page.trial.report.cta.convertible.body")
												: t("page.trial.report.cta.expired.body")}
									</Text>
									<LinkButton href={routes.app.index.href()} size="lg">
										{offer === "converted"
											? t("page.trial.report.cta.converted.action")
											: t("page.trial.report.cta.action")}
									</LinkButton>
								</Card.Content>
							</Card>
						</HeadingScope>
					</div>
				</section>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
