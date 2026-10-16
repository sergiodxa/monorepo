/**
 * Router middleware that scores every form submission with a spam filter before the handler
 * runs, refusing a spam verdict and publishing the assessment as `ctx.spamAssessment`, so a
 * handler only saves what it received and holds the `unsure` ones.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Middleware, RequestContext } from "remix/router";

import { ClientIP } from "@sdxc/get-client-ip/middleware";
import { HoneypotOutcomeKey } from "@sdxc/honeypot/middleware";
import { isSuccess } from "@sdxc/result";
import { CurrentUserAgent } from "@sdxc/user-agent/middleware";
import { createContextKey } from "remix/router";

import type { Submission } from "./check.js";
import type { SpamFilter } from "./filter.js";

/**
 * Declared in an imported module, so a project types `ctx.spamAssessment` by importing this
 * middleware.
 */
declare module "remix/router" {
	interface RequestContext {
		/**
		 * The filter's assessment of this submission, published for every method other than GET,
		 * HEAD and OPTIONS. A `spam` verdict reaches the handler only when `onSpam` answered `null`.
		 */
		spamAssessment: SpamFilter.Assessment;
	}
}

/**
 * The submission's assessment, for code that reads it by key rather than `ctx.spamAssessment`.
 * The type is written out because an exported key needs a nameable type to reach a declaration file.
 */
export const SpamAssessmentKey: { defaultValue?: SpamFilter.Assessment } =
	createContextKey<SpamFilter.Assessment>();

/** Methods that render a form rather than submit one, which pass through unscored. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Content types a browser form submits. */
const FORM_CONTENT_TYPES = ["application/x-www-form-urlencoded", "multipart/form-data"];

/**
 * Form field names, each value read from the submitted form. A missing field or a file reads as
 * empty, so a form that leaves an author field out scores on its content alone.
 */
export interface SpamMiddlewareFields {
	/** What the visitor wrote; several names are scored as one text, joined by line breaks. */
	content: string | readonly string[];
	name?: string;
	email?: string;
	/** The website the author entered, as a comment form's "website" field collects it. */
	url?: string;
}

/** Options for {@link spam}. */
export interface SpamMiddlewareOptions {
	/** The names of the form fields the submission is read from. */
	fields: SpamMiddlewareFields;
	/** @default "text" */
	format?: Submission["format"];
	/** The languages the form expects, as BCP 47 tags. */
	languages?: string[];
	/**
	 * Answers a `spam` verdict: a `Response` refuses the request with it, `null` continues to the
	 * handler with the assessment published on `ctx.spamAssessment`.
	 *
	 * @default a plain-text 422 response
	 */
	onSpam?: (
		assessment: SpamFilter.Assessment,
		ctx: RequestContext,
	) => Response | null | Promise<Response | null>;
}

/**
 * Scores every submission with `filter`: the form fields named in `options.fields`, plus
 * `ctx.ip`, `ctx.userAgent` and the honeypot's verified render time when their middleware ran
 * earlier. The body stays readable; with `formData()` installed, the parsed form is reused.
 *
 * @param filter - The filter that scores each submission
 * @param options - Where the submission's fields are and how a spam verdict is answered
 * @returns The middleware
 * @example router.post(routes.contact.action, { middleware: [spam(filter, { fields: { content: "message" } })], handler })
 */
export function spam(filter: SpamFilter, options: SpamMiddlewareOptions): Middleware {
	return async (ctx, next) => {
		if (SAFE_METHODS.has(ctx.request.method)) return next();

		let form = (await readForm(ctx)) ?? new FormData();
		let assessment = await filter.check({
			content: [options.fields.content]
				.flat()
				.map((name) => field(form, name) ?? "")
				.join("\n"),
			format: options.format,
			languages: options.languages,
			renderedAt: renderedAt(ctx),
			author: {
				name: field(form, options.fields.name),
				email: field(form, options.fields.email),
				url: field(form, options.fields.url),
				ip: ctx.get(ClientIP)?.toString(),
				userAgent: ctx.get(CurrentUserAgent).raw || undefined,
			},
		});

		ctx.set(SpamAssessmentKey, assessment, { property: "spamAssessment" });
		if (assessment.verdict !== "spam") return next();

		let answer = await (options.onSpam ?? refuse)(assessment, ctx);
		return answer ?? next();
	};
}

/** The text of the field named `name`, or `undefined` when it is unnamed, missing or a file. */
function field(form: FormData, name: string | undefined): string | undefined {
	let value = name === undefined ? null : form.get(name);
	return typeof value === "string" ? value : undefined;
}

/** When the honeypot middleware verified this form was rendered, if it ran and passed. */
function renderedAt(ctx: RequestContext): Date | undefined {
	let outcome = ctx.has(HoneypotOutcomeKey) ? ctx.get(HoneypotOutcomeKey) : undefined;
	return outcome !== undefined && isSuccess(outcome) ? outcome.data.renderedAt : undefined;
}

/**
 * The submitted form, or `null` when the body is not one. Reads `formData()`'s parsed form when
 * present, and otherwise a clone of the request, leaving the original body for the handler.
 */
async function readForm(ctx: RequestContext): Promise<FormData | null> {
	let parsed = ctx.has(FormData) ? ctx.get(FormData) : undefined;
	if (parsed !== undefined) return parsed;
	let contentType = ctx.request.headers.get("Content-Type") ?? "";
	if (!FORM_CONTENT_TYPES.some((type) => contentType.includes(type))) return null;
	try {
		return await ctx.request.clone().formData();
	} catch {
		return null;
	}
}

/** The default answer to spam: a 422, since the submission was understood and refused. */
function refuse(): Response {
	return new Response("Submission refused as spam", { status: 422 });
}
