/**
 * Akismet as a remote spam check: posts a submission to `comment-check` and turns the answer
 * into weighted signals, and forwards moderators' decisions to `submit-spam` and `submit-ham`
 * so Akismet's network learns from this site's corrections.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";
import * as s from "remix/data-schema";

import type { Label, Signal, SpamCheck, Submission } from "./check.js";

import { SpamCheckError } from "./check.js";

/** The REST API root every Akismet call goes to. */
const AKISMET_API_URL = "https://rest.akismet.com/1.1";

/** The only `comment-check` bodies that carry a verdict; `invalid` is handled before them. */
const COMMENT_CHECK_ANSWER = s.enum_(["true", "false"]);

/**
 * Checks submissions against Akismet's cross-site reputation network. Akismet requires the
 * author's IP, so a submission without `author.ip` answers no signals and makes no request.
 * `true` is spam, `true` with `X-akismet-pro-tip: discard` is blatant spam that clears the
 * default spam threshold alone, and `false` is a small ham signal, since Akismet vouches for it.
 *
 * @example let check = akismet({ apiKey: env.AKISMET_API_KEY, blog: "https://example.com" });
 */
export function akismet(options: akismet.Options): SpamCheck {
	let spamScore = options.spamScore ?? 8;
	let discardScore = options.discardScore ?? 12;
	let hamScore = options.hamScore ?? -2;
	let reportTimeout = options.reportTimeout ?? 10_000;

	return {
		name: "akismet",
		stage: "remote",

		/**
		 * Asks `comment-check` for a verdict under the filter's abort signal. A bad key is
		 * `misconfigured`, a network failure or non-OK status `unavailable`, and any body other
		 * than `true`, `false` or `invalid` is `invalid-response`.
		 */
		async check(submission, { signal }): Promise<Result<Signal[], SpamCheckError>> {
			let body = formFields(options, submission);
			if (body === null) return success([]);

			let answer = await post("comment-check", body, signal);
			if (isFailure(answer)) return answer;
			let { text, headers } = answer.data;

			let parsed = s.parseSafe(COMMENT_CHECK_ANSWER, text);
			if (!parsed.success) {
				return failure(new SpamCheckError("invalid-response", `comment-check answered "${text}"`));
			}
			if (parsed.value === "false") {
				return success([
					{ check: "akismet.ham", score: hamScore, detail: "Akismet considers it legitimate" },
				]);
			}
			if (headers.get("x-akismet-pro-tip")?.toLowerCase() === "discard") {
				return success([
					{ check: "akismet.discard", score: discardScore, detail: "Akismet flagged blatant spam" },
				]);
			}
			return success([{ check: "akismet.spam", score: spamScore, detail: "Akismet flagged spam" }]);
		},

		/**
		 * Sends a moderator's decision as `submit-spam` or `submit-ham` with the fields
		 * `comment-check` received, so Akismet can correct itself. A submission without
		 * `author.ip` was never checked by Akismet, so its report succeeds without a request.
		 */
		async report(submission: Submission, label: Label): Promise<Result<void, SpamCheckError>> {
			let body = formFields(options, submission);
			if (body === null) return success(undefined);

			let endpoint = label === "spam" ? "submit-spam" : "submit-ham";
			let answer = await post(endpoint, body, AbortSignal.timeout(reportTimeout));
			if (isFailure(answer)) return answer;
			return success(undefined);
		},
	};
}

/** A body Akismet answered with a 2xx status and a key it accepted. */
interface AkismetAnswer {
	text: string;
	headers: Headers;
}

/**
 * The form fields Akismet reads, from the options and the submission. Absent fields stay out of
 * the form, so Akismet sees them as unknown rather than empty.
 *
 * @returns The form, or `null` when the submission has no author IP, which Akismet requires
 */
function formFields(options: akismet.Options, submission: Submission): URLSearchParams | null {
	let author = submission.author;
	if (author?.ip === undefined || author.ip === "") return null;

	let body = new URLSearchParams({
		api_key: options.apiKey,
		blog: options.blog,
		user_ip: author.ip,
		comment_type: options.commentType ?? "comment",
		comment_content: submission.content,
	});
	let optional: Array<[string, string | undefined]> = [
		["user_agent", author.userAgent],
		["comment_author", author.name],
		["comment_author_email", author.email],
		["comment_author_url", author.url],
		["blog_lang", options.blogLang],
		["comment_date_gmt", submission.submittedAt?.toISOString()],
	];
	for (let [name, value] of optional) {
		if (value !== undefined && value !== "") body.set(name, value);
	}
	if (options.isTest) body.set("is_test", "1");
	return body;
}

/**
 * Posts `body` to one Akismet endpoint. Akismet reports a rejected key with a 200 whose body is
 * `invalid` or with an `X-akismet-debug-help` header, and both become `misconfigured` carrying
 * Akismet's explanation; a network failure or non-OK status becomes `unavailable`.
 */
async function post(
	endpoint: string,
	body: URLSearchParams,
	signal: AbortSignal,
): Promise<Result<AkismetAnswer, SpamCheckError>> {
	let response: Response;
	let text: string;
	try {
		response = await fetch(`${AKISMET_API_URL}/${endpoint}`, { method: "POST", body, signal });
		text = (await response.text()).trim();
	} catch (error) {
		let message = error instanceof Error ? error.message : String(error);
		return failure(new SpamCheckError("unavailable", message));
	}

	if (!response.ok) {
		return failure(
			new SpamCheckError("unavailable", `${endpoint} answered HTTP ${response.status}`),
		);
	}
	let debugHelp = response.headers.get("x-akismet-debug-help");
	if (text === "invalid" || debugHelp !== null) {
		return failure(
			new SpamCheckError("misconfigured", debugHelp ?? `${endpoint} refused the API key`),
		);
	}
	return success({ text, headers: response.headers });
}

/** The options {@link akismet} takes. */
export namespace akismet {
	/** The Akismet account, the site it is registered for, and the weight of each answer. */
	export interface Options {
		/** The Akismet API key; it never reaches the browser. */
		apiKey: string;
		/** The front page of the site the key is registered for, such as `https://example.com`. */
		blog: string;
		/**
		 * What kind of content is checked, in Akismet's vocabulary: `comment`, `reply`,
		 * `forum-post`, `blog-post`, `contact-form`, `signup` or `message`.
		 *
		 * @default "comment"
		 */
		commentType?: string;
		/** The languages the site is written in, comma-separated ISO 639-1 codes such as `en, fr`. */
		blogLang?: string;
		/**
		 * Sends `is_test=1`, so Akismet answers without learning from the call; for development
		 * and automated tests.
		 *
		 * @default false
		 */
		isTest?: boolean;
		/**
		 * The score when Akismet answers spam. It lands in the default unsure band, so a moderator
		 * sees it unless other signals push it over.
		 *
		 * @default 8
		 */
		spamScore?: number;
		/**
		 * The score when Akismet marks spam as blatant with `X-akismet-pro-tip: discard`; it clears
		 * the default spam threshold on its own.
		 *
		 * @default 12
		 */
		discardScore?: number;
		/**
		 * The score when Akismet answers ham. It is negative, so Akismet's vouching offsets a weak
		 * local signal without cancelling a strong one.
		 *
		 * @default -2
		 */
		hamScore?: number;
		/**
		 * Milliseconds a `submit-spam` or `submit-ham` call may take before it fails `unavailable`.
		 *
		 * @default 10000
		 */
		reportTimeout?: number;
	}
}
