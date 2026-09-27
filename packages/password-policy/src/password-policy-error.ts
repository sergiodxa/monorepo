/**
 * The failure every check in this package reports: a `PasswordPolicyError` whose
 * `issue` names the rule the candidate broke plus the data a message needs, so an app
 * switches over `issue.reason` to render its own copy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * A candidate password a check refused, or a breached-password lookup that could not
 * answer. `issue` is the stable, exhaustive part; `message` is English for logs only.
 */
export class PasswordPolicyError extends Error {
	override name = "PasswordPolicyError";

	/** The rule that refused the candidate and the values a message interpolates. */
	readonly issue: PasswordPolicyError.Issue;

	/**
	 * @param issue - Why the candidate was refused.
	 * @param options - The underlying error, for a lookup or verification that failed.
	 */
	constructor(issue: PasswordPolicyError.Issue, options?: { cause?: unknown }) {
		super(describeIssue(issue), options);
		this.issue = issue;
	}
}

/** An English sentence per reason, for logs and stack traces. */
function describeIssue(issue: PasswordPolicyError.Issue): string {
	switch (issue.reason) {
		case "too-short":
			return `Password has ${issue.length} characters; at least ${issue.minLength} are required`;
		case "too-long":
			return `Password has ${issue.length} characters; at most ${issue.maxLength} are allowed`;
		case "common":
			return "Password is on the list of commonly used passwords";
		case "similar-to-identifier":
			return "Password contains the account's own identifier";
		case "denied-term":
			return `Password contains the denied term "${issue.term}"`;
		case "breached":
			return `Password appears ${issue.occurrences} times in known data breaches`;
		case "breach-check-unavailable":
			return `Breached-password lookup failed (${issue.failure})`;
		case "reused":
			return `Password matches previous password ${issue.index}`;
		case "history-check-unavailable":
			return `Previous password ${issue.index} could not be verified`;
	}
}

export namespace PasswordPolicyError {
	/** Fewer code points, after NFKC, than the configured minimum. */
	export interface TooShort {
		reason: "too-short";
		minLength: number;
		length: number;
	}

	/** More code points, after NFKC, than the configured maximum. */
	export interface TooLong {
		reason: "too-long";
		maxLength: number;
		length: number;
	}

	/** On the bundled common-password list. */
	export interface Common {
		reason: "common";
	}

	/** Contains, or is contained in, one of the account's identifiers. */
	export interface SimilarToIdentifier {
		reason: "similar-to-identifier";
		/** The folded identifier part that matched: an email local part, domain label or username. */
		fragment: string;
	}

	/** Contains a caller-supplied denied term. */
	export interface DeniedTerm {
		reason: "denied-term";
		/** The term exactly as the caller configured it, ready to show back. */
		term: string;
	}

	/** Pwned Passwords lists the candidate's hash. */
	export interface Breached {
		reason: "breached";
		/** How many times the password appears across the breaches Pwned Passwords holds. */
		occurrences: number;
	}

	/**
	 * The breached-password lookup gave no answer. Every local rule has already accepted
	 * the candidate by then, so a caller accepts it to fail open or refuses it to fail closed.
	 */
	export interface BreachCheckUnavailable {
		reason: "breach-check-unavailable";
		failure: "network" | "timeout" | "status";
		/** The HTTP status for a `status` failure; `null` when no response arrived. */
		status: number | null;
	}

	/** Verifies against one of the account's previous hashes. */
	export interface Reused {
		reason: "reused";
		/** Position of the matching hash in the list passed, `0` being the newest. */
		index: number;
	}

	/**
	 * A stored hash could not be verified and no other hash matched. The error's `cause`
	 * is the verifier's failure; the caller accepts the candidate to fail open or refuses it.
	 */
	export interface HistoryCheckUnavailable {
		reason: "history-check-unavailable";
		/** Position of the first hash that could not be verified. */
		index: number;
	}

	/** Every way a check refuses a candidate; exhaustive, so a `switch` over `reason` closes. */
	export type Issue =
		| TooShort
		| TooLong
		| Common
		| SimilarToIdentifier
		| DeniedTerm
		| Breached
		| BreachCheckUnavailable
		| Reused
		| HistoryCheckUnavailable;

	/** The discriminant of {@link Issue}. */
	export type Reason = Issue["reason"];
}
