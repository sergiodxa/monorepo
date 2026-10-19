/**
 * A fetch-router middleware that shows every email the registry maps, in every language the
 * app speaks, rendered from each template's `preview()` props. It is a development tool: an
 * app mounts it only while developing, since it renders any email for anyone who asks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";
import type { Middleware } from "remix/router";

import { isFailure } from "@sdxc/result";
import { renderToString } from "remix/component/server";

import type { Mail } from "./mail.js";

import { EmailRefusedError } from "./errors.js";

/** Where the previews are served and in which languages. */
export interface PreviewsOptions {
	/**
	 * The languages each email is listed in, such as the app's supported languages. Without
	 * any, each email is listed once, in the translator's fallback.
	 */
	locales?: readonly string[];
	/**
	 * The path the list answers at; one email renders at `<path>/<name>`.
	 * @default "/_emails"
	 */
	path?: string;
	/**
	 * Whether to answer at all; `false` passes every request on, which keeps the middleware in
	 * a typed chain while serving previews only in development, as `import.meta.env.DEV`.
	 * @default true
	 */
	enabled?: boolean;
}

/** One email in the list: its name and whether its template can be previewed. */
interface PreviewEntry {
	name: string;
	previewable: boolean;
}

/** What the list page renders: the base path its links start with, the columns and the rows. */
interface PreviewListProps {
	base: string;
	locales: readonly string[];
	entries: PreviewEntry[];
}

/** The headers of a page that a preview never caches, since the template may change on the next save. */
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Answers `GET` on `options.path` with a page linking every mapped email in every locale, and
 * on `<path>/<name>?locale=<locale>&format=html|text` with that email rendered from its
 * `preview()`: the HTML document, or the subject and the plain-text part. An unmapped email or
 * one without `preview()` answers 404; every other path and method goes to `next()`.
 *
 * @param mail - The app's email registry.
 * @param options - The languages to list and the path to answer at.
 * @example previews(mail, { locales: SUPPORTED_LANGUAGES, enabled: import.meta.env.DEV })
 */
export function previews(mail: Mail, options: PreviewsOptions = {}): Middleware {
	let base = (options.path ?? "/_emails").replace(/\/+$/, "");
	let locales = options.locales ?? [];
	let enabled = options.enabled ?? true;
	return async (ctx, next) => {
		if (!enabled) return next();
		if (ctx.method !== "GET" && ctx.method !== "HEAD") return next();
		let path = ctx.url.pathname;
		if (path === base) return await list(mail, base, locales);
		if (!path.startsWith(`${base}/`)) return next();
		let name = decodeURIComponent(path.slice(base.length + 1));
		let locale = ctx.url.searchParams.get("locale") ?? undefined;
		let format: "html" | "text" = ctx.url.searchParams.get("format") === "text" ? "text" : "html";
		return await show(mail, name, locale, format);
	};
}

/** The list page, with each email's previewability read from its template. */
async function list(mail: Mail, base: string, locales: readonly string[]): Promise<Response> {
	let entries: PreviewEntry[] = [];
	for (let email of mail.mapped) {
		entries.push({ name: email.name, previewable: await mail.hasPreview(email) });
	}
	let html = await renderToString(<PreviewList base={base} locales={locales} entries={entries} />);
	return new Response(`<!doctype html>${html}`, {
		headers: { "Content-Type": "text/html; charset=utf-8", ...NO_STORE },
	});
}

/** One email rendered from its preview props, or the reason it cannot be. */
async function show(
	mail: Mail,
	name: string,
	locale: string | undefined,
	format: "html" | "text",
): Promise<Response> {
	if (!mail.mapped.some((email) => email.name === name)) {
		return plain(`No template is mapped for the "${name}" email.`, 404);
	}
	if (!(await mail.hasPreview(name))) {
		return plain(`The "${name}" email has no preview(); add one to its template.`, 404);
	}
	let rendered = await mail.preview(name, locale);
	if (isFailure(rendered)) {
		let cause = rendered.error.cause instanceof Error ? `\n\n${rendered.error.cause.stack}` : "";
		let status = rendered.error instanceof EmailRefusedError ? 422 : 500;
		return plain(`${rendered.error.message}${cause}`, status);
	}
	if (format === "text") return plain(`Subject: ${rendered.data.subject}\n\n${rendered.data.text}`);
	return new Response(rendered.data.html, {
		headers: { "Content-Type": "text/html; charset=utf-8", ...NO_STORE },
	});
}

/** A plain-text answer, uncached. */
function plain(text: string, status = 200): Response {
	return new Response(text, {
		status,
		headers: { "Content-Type": "text/plain; charset=utf-8", ...NO_STORE },
	});
}

/** The URL of one email's preview in one locale and format. */
function previewHref(base: string, name: string, locale: string | undefined, format: string) {
	let query = new URLSearchParams();
	if (locale !== undefined) query.set("locale", locale);
	if (format === "text") query.set("format", "text");
	let search = query.size === 0 ? "" : `?${query}`;
	return `${base}/${encodeURIComponent(name)}${search}`;
}

/**
 * The list document: a table with one row per email and one column per locale, each cell
 * linking the HTML and the text preview, or saying the email has none.
 */
function PreviewList(handle: Handle<PreviewListProps>) {
	return () => {
		let { base, locales, entries } = handle.props;
		let columns: Array<string | undefined> = locales.length === 0 ? [undefined] : [...locales];
		return (
			<html lang="en">
				<head>
					<meta charset="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<title>Email previews</title>
				</head>
				<body style={{ fontFamily: "system-ui, sans-serif", margin: "2rem" }}>
					<h1>Email previews</h1>
					{entries.length === 0 ? (
						<p>No email is mapped on the registry yet.</p>
					) : (
						<table cellPadding="6">
							<thead>
								<tr>
									<th align="left">Email</th>
									{columns.map((locale) => (
										<th align="left">{locale ?? "Default locale"}</th>
									))}
								</tr>
							</thead>
							<tbody>
								{entries.map((entry) => (
									<tr>
										<td>
											<code>{entry.name}</code>
										</td>
										{entry.previewable ? (
											columns.map((locale) => (
												<td>
													<a href={previewHref(base, entry.name, locale, "html")}>HTML</a>
													{" · "}
													<a href={previewHref(base, entry.name, locale, "text")}>Text</a>
												</td>
											))
										) : (
											<td colSpan={columns.length}>No preview</td>
										)}
									</tr>
								))}
							</tbody>
						</table>
					)}
				</body>
			</html>
		);
	};
}

export default previews;
