/**
 * `GET /try/report/:token` — the seven-day health report as a durable page,
 * addressed by the watch's own token since a trial has no account to guard it.
 *
 * Every figure comes from `watchStats` and `incidentsFrom`, the same
 * functions the emails use, so a reader holding both sees one consistent week.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";

import { formatDate, formatDateTime } from "@sdxc/dates";
import { notFound } from "@sdxc/http/response/html";
import { getServiceContainer } from "@sdxc/service-container";
import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { grid, gridTemplate, hstack, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { bs, m, maxIs, mi, minIs, p, pbe, pbs, pi } from "@sdxc/u/size";
import { fontSize, leading, textAlign, weight, wordBreak } from "@sdxc/u/typography";
import { Card, Heading, HeadingScope, LinkButton, Text } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/router";

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
 * What a figure reads as when there is no data behind it: an em dash, since a
 * zero would misstate a week nothing has answered in yet.
 */
const NO_DATA = "—";

/**
 * The zone every instant on the page renders in: with no account behind a
 * trial there is no stored timezone, so every timestamp renders in the same
 * UTC the trial emails use.
 */
const REPORT_ZONE = "UTC";

/** One labelled figure in a card's row of them. */
interface Figure {
	label: string;
	value: string;
}

/**
 * The window the report covers: the watch's seven days, clamped at `now` so
 * it stops at the checks that have actually run partway through a trial.
 */
function reportPeriod(watch: SelectTrialWatch, now: number) {
	return { from: watch.created_at, to: Math.min(now, watch.expires_at) };
}

/**
 * The response-time figures, or `null` when nothing ever answered. Derived
 * only from checks that carry a timing, since folding an unreachable target's
 * missing duration in as zero would report a down site as instantaneous.
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
 * The uptime ratio as the reader's own locale writes a percentage:
 * `watchStats` supplies the digits, matching what the emails print, and
 * `Intl` places the symbol since where it goes is locale data it already owns.
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
 * One incident as a sentence: when the first failure was seen and how many
 * consecutive checks failed, since checks land an hour apart and any duration
 * would claim minutes nobody observed.
 */
function incidentLine(incident: TrialIncident, locale: string, t: TFunction) {
	return t("page.trial.report.incidents.entry", {
		started: formatDateTime(new Date(incident.startedAt), { locale, timeZone: REPORT_ZONE }),
		/**
		 * `count`, so the sentence declines "one check" against "four checks" in
		 * whichever language renders it.
		 */
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
	 * Whether anything has been measured at all. Every "nothing went wrong"
	 * statement on the page is gated on this: with no completed check, an empty
	 * incident list simply means nobody has looked yet.
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
														raw({ flex: "1" }),
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
