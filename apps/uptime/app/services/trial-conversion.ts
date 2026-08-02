/**
 * Turns the targets someone probed on the public trial page into real monitors, at the
 * moment they sign in with the address they left behind.
 *
 * An anonymous visitor hands over an email, we watch their URL hourly for a week, and for
 * thirty days from each attempt that URL is claimable. This is the claim: an address is the
 * only thing a lead and a signed-in subject are known to share, so sign-in looks for a lead
 * with the subject's address and creates a monitor for every attempt whose own window is
 * still open. What is convertible is `~/app/data/trial-watch.ts`'s decision, not this
 * module's — each watch carries its own clock, so a lead who tried three URLs a few days
 * apart can have two of them claimed and the third already lapsed.
 *
 * **Nothing here may block sign-in.** Auto-creating monitors is a nicety on the one path a
 * user cannot route around, so every failure is logged and swallowed, in the shape
 * `Customer.cancelSubscriptions` and `CheckHttpJob`'s alert dispatch already use. A lead
 * lookup that fails costs someone an empty dashboard; a lead lookup that throws would cost
 * them their account.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { logger } from "@pkg/logger";

import type { SelectTrialWatch } from "~/database/schema";

import Lead from "~/app/data/lead";
import Monitor from "~/app/data/monitor";
import TrialWatch from "~/app/data/trial-watch";

/**
 * The cadence a converted monitor runs at.
 *
 * Ten minutes is `CreateMonitorSchema`'s default rather than the `monitors` table's own
 * sixty seconds, because the target of this rule is a monitor indistinguishable from one the
 * person would have made in the form, and the form is where a human's default comes from.
 * Every other setting — method, expected status, timeout, degraded threshold, region — is
 * left to the column defaults, which is exactly what the form's untouched fields do.
 *
 * Duplicated from the validator rather than imported, because a service reaching into
 * `~/app/http` would invert the dependency between the two layers for one integer.
 */
const CONVERTED_INTERVAL_SECONDS = 600;

/** Who signed in, and where their claimed targets go. */
export interface TrialConversion {
	/** The authenticated subject's address, matched against `leads.email`. */
	email: string;
	/** The team they were just provisioned into, which must already exist. */
	teamId: string;
	/** The subject, recorded as the created monitors' author. */
	authorId: string;
}

/**
 * Claims every trial target this address is still owed a monitor for, into `teamId`.
 *
 * **Runs on every sign-in, not only on first provisioning.** The tempting reading is that
 * conversion is part of onboarding, but the offer is attached to the attempt and not to the
 * account: someone can create an account in January, probe a URL on the trial page in
 * February, and sign in again the same afternoon — a first-provisioning-only rule would
 * never look, and that watch would lapse unclaimed thirty days later with nobody able to say
 * why. The weekly wrap-up email points its call to action at the app precisely so a reader
 * arrives through sign-in with their targets already converted, and that reader may well
 * already have an account. Running every time costs one indexed read of a unique column,
 * which returns nothing for the overwhelming majority of sign-ins.
 *
 * That is only affordable because it is **idempotent**, and idempotent on a recorded fact
 * rather than an inferred one: `TrialWatch.markConverted` stamps `converted_at`, and a watch
 * carrying it is no longer convertible. Matching on "a monitor with this URL already exists"
 * was the alternative and is wrong twice over — it would refuse to convert a target the
 * person happens to already monitor deliberately, and it would silently re-claim a watch
 * whose monitor they had since deleted.
 *
 * **Converted monitors arrive enabled**, which `Monitor.create` does by default and this
 * deliberately does not override. A disabled monitor has no status, no history and no next
 * check, so an account converted into one is an empty account with a chore attached: the
 * person has to find a toggle they were never told about to get the thing they had already
 * asked for. And they did ask — leaving an address on the trial page is a request to watch
 * that URL, which we have been honouring hourly for a week at our own cost, so continuing it
 * on their account is the same act and not a new commitment made on their behalf. The
 * metered-allowance objection is real but bounded and visible: one monitor at ten minutes,
 * on a row they can see and delete in a click, against a disabled one they would never
 * notice was there.
 *
 * **There is no per-team cap on HTTP monitors to respect.** `MAX_DNS_MONITORS_PER_TEAM`
 * bounds DNS monitors and nothing bounds these, so converting cannot push a team over a
 * limit that does not exist, and inventing one here would enforce a rule the create form
 * does not. The count is bounded anyway by what a lead can accumulate: a watch only exists
 * because someone completed a rate-limited probe on the public page.
 *
 * Awaited rather than deferred past the response: the promise is an account that is useful
 * on arrival, and a dashboard that fills in a second after it renders is a worse first
 * impression than one that was simply slower to open.
 *
 * Never throws.
 */
export async function convertTrialWatches(db: Database, subject: TrialConversion): Promise<void> {
	try {
		let lead = await Lead.findByEmail(db, subject.email);
		if (!lead) return;

		let watches = await TrialWatch.listConvertibleByLead(db, lead.id, Date.now());
		if (watches.length === 0) return;

		let converted = 0;
		for (let watch of watches) {
			if (await convertWatch(db, subject, watch)) converted += 1;
		}

		logger.info("trial_conversion.completed", {
			leadId: lead.id,
			teamId: subject.teamId,
			claimable: watches.length,
			converted,
		});
	} catch (error) {
		logger.error("trial_conversion.failed", {
			teamId: subject.teamId,
			authorId: subject.authorId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/**
 * Converts one watch, reporting whether it became a monitor.
 *
 * Caught per watch and not only around the loop, so that one unconvertible target does not
 * take the other two down with it — a lead who asked for three URLs and got one is a bug
 * worth logging, but a lead who asked for three and got none because the first failed is the
 * same bug made three times worse.
 *
 * The monitor is created before the watch is stamped, and the order is deliberate. Nothing
 * spans the two writes, so one of them can land alone: this way a failure leaves a monitor
 * the person can see and delete, and the next sign-in creates a duplicate they can also see.
 * Stamping first would trade that for a claim silently consumed by a monitor that never
 * existed, which nothing downstream could detect or undo.
 *
 * No on-demand `Monitor.ping`, unlike the create form. The form pings because a visitor is
 * looking at the monitor they just made and a dash where a status goes reads as broken;
 * nobody is looking at these yet, `Monitor.create` leaves them due immediately, and the
 * every-minute sweep reaches them before the person finishes reading their dashboard. One
 * queue write per claimed target on the sign-in path buys nothing for that minute.
 */
async function convertWatch(
	db: Database,
	subject: TrialConversion,
	watch: SelectTrialWatch,
): Promise<boolean> {
	try {
		let monitor = await Monitor.create(db, subject.teamId, subject.authorId, {
			name: monitorName(watch.url),
			url: watch.url,
			interval_seconds: CONVERTED_INTERVAL_SECONDS,
		});

		await TrialWatch.markConverted(db, watch.id, monitor.id);
		return true;
	} catch (error) {
		logger.error("trial_conversion.watch_failed", {
			watchId: watch.id,
			teamId: subject.teamId,
			error: error instanceof Error ? error.message : String(error),
		});
		return false;
	}
}

/**
 * What to call a monitor nobody named. The host, without the `www.` a person would not have
 * typed into the name field, which is the name the create form's own users overwhelmingly
 * give theirs. The path is dropped: a target is one URL, but the row it becomes is read as
 * "is my site up", and `example.com` says that where `example.com/health` reads as a detail.
 *
 * Falls back to the stored URL if it will not parse, which the trial page's own validation
 * should already have made impossible — a monitor with an ugly name is still a monitor, and
 * throwing here would cost the person the conversion over cosmetics.
 */
function monitorName(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}
