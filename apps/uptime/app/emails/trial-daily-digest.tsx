/**
 * One day of a lead's free watches, grouped by address so every URL they watch lands
 * in one digest. The bar is one segment per hour, matching the watch's own check
 * frequency, so every bad hour stays visible in the record. Several URLs get a
 * roll-up line plus a headed section each; a single URL collapses both into one
 * plain report (ADR-030).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@pkg/i18n";
import type { Address } from "@pkg/mail";
import type { Handle, RemixElement } from "remix/ui";

import { Email } from "@pkg/mail";

import type { TrialStats, TrialStatus } from "~/app/emails/shared/trial";
import type { UptimeBar } from "~/app/emails/shared/uptime-bar";

import { DARK_STYLES } from "~/app/emails/shared/palette";
import {
	TrialReport,
	TrialFooter,
	trialDisplayUrl,
	trialStatusKey,
	trialUnsubscribeHeaders,
} from "~/app/emails/shared/trial";

export namespace TrialDailyDigestEmail {
	/** One watched URL's day, as the digest reports it. */
	export interface Target {
		/** URL being watched, reported verbatim. */
		url: string;
		/** Where it stood at the last check of the day. */
		status: TrialStatus;
		/** The day's 24 hourly checks, oldest first; a missing hour is `null`. */
		segments: UptimeBar.Status[];
		/** The numbers under this URL's bar. */
		stats: TrialStats;
	}

	/** Everything the daily digest needs: one address and everything it is watching. */
	export interface Data {
		/** Address the visitor handed over on the try-it page. */
		to: string;
		/** Every URL this address is watching, in the order they were added; never empty. */
		targets: Target[];
		/** The lead's unguessable token, which the footer link and the headers are built from. */
		unsubscribeToken: string;
		/** Language the copy is produced in, recorded beside the translator it came from. */
		locale: string;
		/** Translator already bound to {@link locale} by the sender. */
		t: TFunction;
	}
}

namespace TargetSection {
	/** Props accepted by {@link TargetSection}. */
	export interface Props {
		/** The URL this section reports. */
		target: TrialDailyDigestEmail.Target;
		/** Whether to head the section with the URL; false when the email covers only it. */
		headed: boolean;
		/** Translator already bound to the reader's language. */
		t: TFunction;
	}
}

/** One URL's section of a multi-URL digest: its heading, then its bar and numbers. */
function TargetSection(handle: Handle<TargetSection.Props>) {
	return () => {
		let { target, headed, t } = handle.props;

		return (
			<>
				{headed ? (
					<Email.Heading level={2}>
						{t("emails.trial.daily.target", {
							url: trialDisplayUrl(target.url),
							status: t(trialStatusKey(target.status)),
						})}
					</Email.Heading>
				) : null}
				<TrialReport
					segments={target.segments}
					stats={target.stats}
					rangeStart={t("emails.trial.daily.rangeStart")}
					rangeEnd={t("emails.trial.daily.rangeEnd")}
					t={t}
				/>
			</>
		);
	};
}

/**
 * A day of hourly checks across everything one address is watching, reported as a
 * plain status update.
 *
 * @example ctx.email.later(new TrialDailyDigestEmail({ to, targets, locale, t }));
 */
export class TrialDailyDigestEmail implements Email {
	/** The day this email reports; nothing is loaded while rendering. */
	#digest: TrialDailyDigestEmail.Data;

	/**
	 * Creates the email.
	 *
	 * @param digest - The day's targets and the translator for them.
	 */
	constructor(digest: TrialDailyDigestEmail.Data) {
		this.#digest = digest;
	}

	/** The address every target in this digest belongs to. */
	get to(): Address {
		return { email: this.#digest.to };
	}

	/**
	 * Subject naming the one URL, or counting them when there are several, using two
	 * translation keys since each form interpolates different variables and a plural
	 * rule can only vary wording around a single one.
	 */
	get subject(): string {
		let { t } = this.#digest;
		let only = this.#only();
		if (only) return t("emails.trial.daily.subject", { url: trialDisplayUrl(only.url) });
		return t("emails.trial.daily.subjectMany", { total: this.#digest.targets.length });
	}

	/** One-click unsubscribe, for the clients that render their own button for it. */
	get headers(): Record<string, string> {
		return trialUnsubscribeHeaders(this.#digest.unsubscribeToken);
	}

	/** Body tree: the headline, the roll-up when there is one, a report per URL, the footer. */
	body(): RemixElement {
		let { t, locale, targets, unsubscribeToken } = this.#digest;
		let only = this.#only();
		let heading = only
			? t("emails.trial.daily.heading", { url: trialDisplayUrl(only.url) })
			: t("emails.trial.daily.headingMany", { total: targets.length });
		let preview = only
			? t("emails.trial.daily.preview", { url: trialDisplayUrl(only.url) })
			: t("emails.trial.daily.previewMany", { total: targets.length });

		return (
			<Email.Layout lang={locale} title={heading} preview={preview} darkStyles={DARK_STYLES}>
				<Email.Heading>{heading}</Email.Heading>
				{only ? null : <Email.Text>{this.#summary()}</Email.Text>}
				{targets.map((target) => (
					<TargetSection key={target.url} target={target} headed={only === null} t={t} />
				))}
				<Email.Footer>
					<TrialFooter
						unsubscribeToken={unsubscribeToken}
						reason={t("emails.trial.daily.footer")}
						t={t}
					/>
				</Email.Footer>
			</Email.Layout>
		);
	}

	/** The single target when the digest covers exactly one, otherwise `null`. */
	#only(): TrialDailyDigestEmail.Target | null {
		let { targets } = this.#digest;
		return targets.length === 1 ? (targets[0] ?? null) : null;
	}

	/** The roll-up line, worded as "all of them" when nothing is wrong. */
	#summary(): string {
		let { t, targets } = this.#digest;
		let total = targets.length;
		let up = targets.filter((target) => target.status === "up").length;

		if (up === total) return t("emails.trial.daily.summaryAll", { total });
		return t("emails.trial.daily.summary", { up, total });
	}
}
