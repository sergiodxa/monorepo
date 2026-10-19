/**
 * One day of a lead's free watches, grouped by address so every URL they watch lands in one
 * digest. The bar is one segment per hour, matching the watch's own check frequency. Several
 * URLs get a roll-up line plus a headed section each; a single URL collapses into one report.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EmailInput, EmailPropsOutput, EmailTranslate } from "@sdxc/mail";
import type { Handle } from "remix/component";

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";
import { DARK_STYLES } from "~/app/emails/shared/palette";
import {
	TRIAL_MAILING_LIST,
	trialDisplayUrl,
	TrialFooter,
	TrialReport,
	trialStatusKey,
	trialUnsubscribeUrl,
} from "~/app/emails/shared/trial";

/** What every member of the template reads: the day's targets, the reader's locale and `t`. */
type Digest = EmailInput<EmailPropsOutput<typeof emails.trial.dailyDigest>>;

/** One watched URL's day, as the digest reports it. */
type Target = Digest["targets"][number];

namespace TargetSection {
	/** Props accepted by {@link TargetSection}. */
	export interface Props {
		/** The URL this section reports. */
		target: Target;
		/** Whether to head the section with the URL; false when the email covers only it. */
		headed: boolean;
		/** Translator already bound to the reader's language. */
		t: EmailTranslate;
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

export default createEmail(emails.trial.dailyDigest, {
	/**
	 * Names the one URL, or counts them when there are several, using two keys since each form
	 * interpolates different variables and a plural rule varies wording around a single one.
	 */
	subject: (digest) => {
		let one = only(digest);
		if (one) return digest.t("emails.trial.daily.subject", { url: trialDisplayUrl(one.url) });
		return digest.t("emails.trial.daily.subjectMany", { total: digest.targets.length });
	},
	unsubscribe: ({ unsubscribeToken }) => ({ url: trialUnsubscribeUrl(unsubscribeToken) }),
	/** The trial list, shared by every trial email so one unsubscribe stops them all. */
	list: () => TRIAL_MAILING_LIST,
	/** The headline, the roll-up when there is one, a report per URL, the footer. */
	body: (handle) => () => {
		let { t, locale, targets, unsubscribeToken } = handle.props;
		let one = only(handle.props);
		let heading = one
			? t("emails.trial.daily.heading", { url: trialDisplayUrl(one.url) })
			: t("emails.trial.daily.headingMany", { total: targets.length });
		let preview = one
			? t("emails.trial.daily.preview", { url: trialDisplayUrl(one.url) })
			: t("emails.trial.daily.previewMany", { total: targets.length });

		return (
			<Email.Layout lang={locale} title={heading} preview={preview} darkStyles={DARK_STYLES}>
				<Email.Heading>{heading}</Email.Heading>
				{one ? null : <Email.Text>{summary(handle.props)}</Email.Text>}
				{targets.map((target) => (
					<TargetSection key={target.url} target={target} headed={one === null} t={t} />
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
	},
	preview: () => ({
		targets: [
			{
				url: "https://example.com",
				status: "up",
				segments: Array.from({ length: 24 }, () => "up"),
				stats: { checks: 24, uptime: "100", slowestResponseMs: 310 },
			},
			{
				url: "https://api.example.com",
				status: "down",
				segments: Array.from({ length: 24 }, (_, hour) => (hour < 20 ? "up" : "down")),
				stats: { checks: 24, uptime: "83.3", slowestResponseMs: 1800 },
			},
		],
		unsubscribeToken: "preview",
	}),
});

/** The single target when the digest covers exactly one, otherwise `null`. */
function only({ targets }: Digest): Target | null {
	return targets.length === 1 ? (targets[0] ?? null) : null;
}

/** The roll-up line, worded as "all of them" when nothing is wrong. */
function summary({ t, targets }: Digest): string {
	let total = targets.length;
	let up = targets.filter((target) => target.status === "up").length;

	if (up === total) return t("emails.trial.daily.summaryAll", { total });
	return t("emails.trial.daily.summary", { up, total });
}
