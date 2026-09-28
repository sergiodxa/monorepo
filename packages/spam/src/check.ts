/**
 * The contract every spam check implements, local rule or remote provider alike: a check reads
 * a submission and answers weighted signals, so the filter can add evidence from any source and
 * explain a verdict by the signals behind it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

/**
 * One piece of user-generated content and what is known about who sent it. Only `content` is
 * required; every other field enables more checks, and a check whose input is absent adds nothing.
 */
export interface Submission {
	content: string;
	/**
	 * How `content` is written. In `text`, Markdown and HTML link syntax count as a signal, since
	 * a plain-text field renders them literally and only a bot pastes them there.
	 *
	 * @default "text"
	 */
	format?: "text" | "markdown" | "html";
	author?: Submission.Author;
	/** When the form was rendered, from a source the visitor cannot forge, such as a signed field. */
	renderedAt?: Date;
	/** @default the time of the check */
	submittedAt?: Date;
	/** The languages the site expects, as BCP 47 tags such as `en` or `pt-BR`. */
	languages?: string[];
}

/** The types describing a {@link Submission}. */
export namespace Submission {
	/** What the form or the session knows about the submission's author. */
	export interface Author {
		name?: string;
		email?: string;
		/** The website the author entered, as a comment form's "website" field collects it. */
		url?: string;
		ip?: string;
		userAgent?: string;
	}
}

/** Whether a submission is spam, as a moderator decided it or a filter scored it. */
export type Label = "spam" | "ham";

/**
 * One piece of evidence. Positive scores point to spam and negative ones to ham, so a provider
 * vouching for a known author can pull a submission back below a threshold.
 */
export interface Signal {
	/** A stable identifier, the check's name and the finding, such as `links.count`. */
	check: string;
	score: number;
	/** What was found, written for a moderator reading why a submission was held. */
	detail?: string;
}

/**
 * A source of signals. The filter runs `local` checks first, in order and without a timeout, so a
 * local check reads only the app's own data; `remote` checks run in parallel under a timeout, and
 * `escalation` checks only for a submission still in the unsure band.
 */
export interface SpamCheck {
	/** Identifies the check in a failure report; signals carry their own `check` identifier. */
	readonly name: string;
	readonly stage: SpamCheck.Stage;

	/**
	 * Scores one submission, answering signals directly or, when it reads storage or a network, a
	 * `Result` whose failure means no evidence either way, never a verdict.
	 *
	 * @param submission - The submission to score
	 * @param options - The abort signal bounding the call and the score earlier stages reached
	 */
	check(
		submission: Submission,
		options: SpamCheck.Options,
	): Signal[] | Promise<Result<Signal[], SpamCheckError>>;

	/**
	 * Learns from a moderator's decision, for checks that train on them or forward them to a
	 * provider. A check without it ignores reports.
	 *
	 * @param submission - The submission as it was checked
	 * @param label - What the moderator decided it is
	 */
	report?(submission: Submission, label: Label): Promise<Result<void, SpamCheckError>>;
}

/** The types shared by every {@link SpamCheck}. */
export namespace SpamCheck {
	/** When a check runs; see {@link SpamCheck}. */
	export type Stage = "local" | "remote" | "escalation";

	/** What the filter passes to every call. */
	export interface Options {
		/** Aborts when the check's timeout elapses; a remote check passes it to `fetch`. */
		signal: AbortSignal;
		/** The total of every signal from earlier stages. */
		score: number;
		/** The signals earlier stages produced, so an escalation check can weigh the evidence. */
		signals: readonly Signal[];
	}

	/**
	 * Why a check produced no evidence. `unavailable` is the provider failing, `timeout` is the
	 * filter's deadline passing, `misconfigured` is a key or option the provider refused, and
	 * `invalid-response` is an answer in a shape the check cannot read.
	 */
	export type ErrorCode = "unavailable" | "timeout" | "misconfigured" | "invalid-response";
}

/**
 * A check that produced no evidence. `code` is what to branch on and log; the message carries
 * the provider's own detail.
 *
 * @example if (error.code === "misconfigured") log.error("spam.misconfigured", { message: error.message });
 */
export class SpamCheckError extends Error {
	override name = "SpamCheckError";

	readonly code: SpamCheck.ErrorCode;

	/**
	 * @param code - The reason, the value to branch on
	 * @param message - The provider's detail, for logs
	 */
	constructor(code: SpamCheck.ErrorCode, message?: string) {
		super(
			message === undefined
				? `Spam check failed: ${code}`
				: `Spam check failed: ${code} (${message})`,
		);
		this.code = code;
	}
}
