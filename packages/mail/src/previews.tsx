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
import { bg, border, borderEdge, colorScheme, fg } from "@sdxc/u/color";
import { block, flexWrap, grid, gridTemplate, grow, hstack, vstack } from "@sdxc/u/layout";
import { divide, overflowY } from "@sdxc/u/overflow";
import { media } from "@sdxc/u/responsive";
import { bs, is, m, maxBs, minBs, minIs, p } from "@sdxc/u/size";
import { aria, hover } from "@sdxc/u/state";
import {
	font,
	fontSize,
	lineClamp,
	textDecoration,
	truncate,
	weight,
	whiteSpace,
} from "@sdxc/u/typography";
import { Avatar, Badge, Empty, Heading, Item, Link, LinkButton, Text } from "@sdxc/ui";
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
	 * The stylesheets the page links, which carry `@sdxc/ui`'s reset, theme and the app's palette,
	 * such as the ones the app's document links; without any, the components render unthemed.
	 * @example stylesheets: () => assetResolver.getStylesheets("resources/layouts/document.tsx")
	 */
	stylesheets?: () => readonly string[] | Promise<readonly string[]>;
	/**
	 * Whether to answer at all; `false` passes every request on, which keeps the middleware in
	 * a typed chain while serving previews only in development, as `import.meta.env.DEV`.
	 * @default true
	 */
	enabled?: boolean;
}

/** One email in the inbox: its name and, when its template can be previewed, how it reads. */
interface InboxEntry {
	name: string;
	previewable: boolean;
	/** The rendered subject, or why the preview failed to render. */
	subject?: string;
	/** The start of the text part, as a mail client shows it under the subject. */
	snippet?: string;
	failed?: boolean;
}

/** What the inbox renders: the list, which email is open, and in which locale and view. */
interface InboxProps {
	base: string;
	locales: readonly string[];
	locale: string | undefined;
	entries: InboxEntry[];
	selected: InboxEntry | undefined;
	/** The name `?email=` asked for, kept when no mapped email answers to it. */
	requested: string | undefined;
	view: "html" | "text";
	/** The selected email's text part, shown in the text view. */
	text: string | undefined;
	stylesheets: readonly string[];
}

/**
 * `path` with every trailing slash removed, by walking back from the end, so the time it takes
 * grows with the path's length whatever the path holds.
 */
function withoutTrailingSlashes(path: string): string {
	let end = path.length;
	while (end > 0 && path[end - 1] === "/") end -= 1;
	return path.slice(0, end);
}

/** The headers of a page that a preview never caches, since the template may change on the next save. */
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Answers `GET` on `options.path` with an inbox of every mapped email, the one `?email=` names
 * open beside the list in the `?locale=` asked for, and on `<path>/<name>?locale=<locale>&format=html|text` with that email rendered from its
 * `preview()`: the HTML document, or the subject and the plain-text part. An unmapped email or
 * one without `preview()` answers 404; every other path and method goes to `next()`.
 *
 * @param mail - The app's email registry.
 * @param options - The languages to list and the path to answer at.
 * @example previews(mail, { locales: SUPPORTED_LANGUAGES, enabled: import.meta.env.DEV })
 */
export function previews(mail: Mail, options: PreviewsOptions = {}): Middleware {
	let base = withoutTrailingSlashes(options.path ?? "/_emails");
	let locales = options.locales ?? [];
	let enabled = options.enabled ?? true;
	let stylesheets = options.stylesheets ?? (() => []);
	return async (ctx, next) => {
		if (!enabled) return next();
		if (ctx.method !== "GET" && ctx.method !== "HEAD") return next();
		let path = ctx.url.pathname;
		if (path === base) return await inbox(mail, base, locales, ctx.url.searchParams, stylesheets);
		if (!path.startsWith(`${base}/`)) return next();
		let name = decodeURIComponent(path.slice(base.length + 1));
		let locale = ctx.url.searchParams.get("locale") ?? undefined;
		let format: "html" | "text" = ctx.url.searchParams.get("format") === "text" ? "text" : "html";
		return await show(mail, name, locale, format);
	};
}

/**
 * The inbox page: every mapped email rendered in the chosen locale for its subject and snippet,
 * and the selected one, by default the first previewable, opened in the reading pane.
 */
async function inbox(
	mail: Mail,
	base: string,
	locales: readonly string[],
	query: URLSearchParams,
	stylesheets: () => readonly string[] | Promise<readonly string[]>,
): Promise<Response> {
	let asked = query.get("locale") ?? undefined;
	let locale = asked !== undefined && locales.includes(asked) ? asked : locales[0];
	let view: "html" | "text" = query.get("view") === "text" ? "text" : "html";
	let requested = query.get("email") ?? undefined;
	let entries: InboxEntry[] = [];
	let texts = new Map<string, string>();
	for (let email of mail.mapped) {
		if (!(await mail.hasPreview(email))) {
			entries.push({ name: email.name, previewable: false });
			continue;
		}
		let rendered = await mail.preview(email.name, locale);
		if (isFailure(rendered)) {
			entries.push({
				name: email.name,
				previewable: true,
				failed: true,
				subject: rendered.error.message,
			});
			continue;
		}
		texts.set(email.name, rendered.data.text);
		entries.push({
			name: email.name,
			previewable: true,
			subject: rendered.data.subject,
			snippet: snippet(rendered.data.text, rendered.data.subject),
		});
	}
	let selected =
		requested === undefined
			? entries.find((entry) => entry.previewable)
			: entries.find((entry) => entry.name === requested);
	let html = await renderToString(
		<PreviewInbox
			base={base}
			locales={locales}
			locale={locale}
			entries={entries}
			selected={selected}
			requested={requested}
			view={view}
			text={selected === undefined ? undefined : texts.get(selected.name)}
			stylesheets={await stylesheets()}
		/>,
	);
	return new Response(`<!doctype html>${html}`, {
		headers: { "Content-Type": "text/html; charset=utf-8", ...NO_STORE },
	});
}

/** The text part collapsed to one line, with a leading repeat of the subject dropped, cut at 140 characters. */
function snippet(text: string, subject: string): string {
	let line = text.replace(/\s+/g, " ").trim();
	if (line.startsWith(subject)) line = line.slice(subject.length).trim();
	return line.length > 140 ? `${line.slice(0, 139).trimEnd()}…` : line;
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

/** The URL of the inbox with one email open, in one locale and view. */
function inboxHref(base: string, name: string, locale: string | undefined, view: string) {
	let query = new URLSearchParams({ email: name });
	if (locale !== undefined) query.set("locale", locale);
	if (view === "text") query.set("view", "text");
	return `${base}?${query}`;
}

/**
 * The inbox document, built from `@sdxc/ui` over the app's own stylesheets: a toolbar with the
 * locale switch, every mapped email listed as a mail client lists messages, and a reading pane
 * with the open email's HTML in a frame or its text part. It stacks into one column on a phone.
 */
function PreviewInbox(handle: Handle<InboxProps>) {
	return () => {
		let { base, locales, locale, entries, selected, requested, view, text, stylesheets } =
			handle.props;
		let readable = selected?.previewable === true && selected.failed !== true;
		return (
			<html lang="en" class="system" mix={colorScheme("light dark")}>
				<head>
					<meta charset="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<title>
						{readable && selected?.subject !== undefined
							? `${selected.subject} · Email previews`
							: "Email previews"}
					</title>
					{stylesheets.map((href) => (
						<link rel="stylesheet" href={href} />
					))}
				</head>
				<body
					mix={[
						grid(),
						gridTemplate({ rows: "auto minmax(0, 1fr)" }),
						bs("100dvh"),
						m(0),
						font("sans"),
						bg("neutral.bg-tint"),
						fg("neutral"),
						media("(max-width: 48rem)", bs("auto")),
					]}
				>
					<header
						mix={[
							hstack({ gap: 4, align: "center" }),
							flexWrap(),
							p(3, 4),
							bg("neutral.bg"),
							borderEdge("block-end", { width: 1, style: "solid", color: "neutral" }),
						]}
					>
						<Heading level={1} mix={[hstack({ gap: 2, align: "center" }), fontSize("lg"), grow()]}>
							Email previews
							<Badge color="neutral">{entries.length}</Badge>
						</Heading>
						{locales.length > 1 ? (
							<nav aria-label="Language" mix={[hstack({ gap: 1, align: "center" }), flexWrap()]}>
								{locales.map((code) => (
									<LinkButton
										href={
											selected === undefined
												? `${base}?locale=${encodeURIComponent(code)}`
												: inboxHref(base, selected.name, code, view)
										}
										aria-current={code === locale ? "true" : undefined}
										color={code === locale ? "brand" : "neutral"}
										variant={code === locale ? "solid" : "ghost"}
										size="sm"
									>
										{code.toUpperCase()}
									</LinkButton>
								))}
							</nav>
						) : null}
					</header>
					<div
						mix={[
							grid(),
							gridTemplate({ columns: "minmax(18rem, 24rem) minmax(0, 1fr)" }),
							minBs(0),
							media("(max-width: 48rem)", gridTemplate({ columns: "minmax(0, 1fr)" })),
						]}
					>
						<nav
							aria-label="Emails"
							mix={[
								overflowY("auto"),
								bg("neutral.bg"),
								borderEdge("inline-end", { width: 1, style: "solid", color: "neutral" }),
								divide(),
								media("(max-width: 48rem)", [maxBs("45dvh"), border("none")]),
							]}
						>
							{entries.length === 0 ? (
								<Empty>
									<Empty.Title>No email is mapped on the registry yet.</Empty.Title>
								</Empty>
							) : (
								entries.map((entry) => (
									<a
										href={inboxHref(base, entry.name, locale, view)}
										aria-current={entry.name === selected?.name ? "true" : undefined}
										mix={[
											block(),
											p(3, 4),
											borderEdge("inline-start", {
												width: 3,
												style: "solid",
												color: "transparent",
											}),
											fg("neutral"),
											textDecoration("none"),
											hover(bg("neutral.bg-tint-hover")),
											aria("current", "true", [
												bg("brand.bg-tint"),
												borderEdge("inline-start", { width: 3, style: "solid", color: "brand" }),
											]),
										]}
									>
										<Item>
											<Item.Media>
												<Avatar>
													<Avatar.Fallback>
														{(entry.name.split(".").pop() ?? entry.name).charAt(0).toUpperCase()}
													</Avatar.Fallback>
												</Avatar>
											</Item.Media>
											<Item.Content>
												<Text mix={[fontSize("xs"), fg("neutral.muted"), font("mono")]}>
													{entry.name}
												</Text>
												<Item.Title mix={[truncate(), weight("semibold")]}>
													{entry.previewable ? (
														<span mix={entry.failed === true ? fg("danger") : []}>
															{entry.subject}
														</span>
													) : (
														<Badge color="warning">No preview</Badge>
													)}
												</Item.Title>
												<Item.Description mix={lineClamp(2)}>
													{entry.previewable
														? entry.snippet
														: "Add preview() to its template to see it here."}
												</Item.Description>
											</Item.Content>
										</Item>
									</a>
								))
							)}
						</nav>
						<main mix={[vstack({ gap: 0 }), minBs(0), minIs(0)]}>
							{!readable || selected === undefined ? (
								<Empty mix={m("auto")} color={selected?.failed === true ? "danger" : "neutral"}>
									<Empty.Title>
										{selected === undefined && requested !== undefined
											? `No template is mapped for the "${requested}" email.`
											: selected === undefined
												? "Select an email to read it."
												: selected.failed === true
													? selected.subject
													: `The "${selected.name}" email has no preview(); add one to its template.`}
									</Empty.Title>
								</Empty>
							) : (
								<>
									<div
										mix={[
											vstack({ gap: 2 }),
											p(4, 5),
											bg("neutral.bg"),
											borderEdge("block-end", { width: 1, style: "solid", color: "neutral" }),
										]}
									>
										<Heading level={2} mix={fontSize("xl")}>
											{selected.subject}
										</Heading>
										<div mix={[hstack({ gap: 3, align: "center" }), flexWrap()]}>
											<Text mix={[grow(), fontSize("xs"), fg("neutral.muted"), font("mono")]}>
												{locale === undefined ? selected.name : `${selected.name} · ${locale}`}
											</Text>
											<nav aria-label="Format" mix={hstack({ gap: 1, align: "center" })}>
												{(["html", "text"] as const).map((format) => (
													<LinkButton
														href={inboxHref(base, selected.name, locale, format)}
														aria-current={format === view ? "true" : undefined}
														color={format === view ? "brand" : "neutral"}
														variant={format === view ? "solid" : "outline"}
														size="sm"
													>
														{format === "html" ? "HTML" : "Text"}
													</LinkButton>
												))}
											</nav>
											<Link href={previewHref(base, selected.name, locale, view)} target="_blank">
												Open raw
											</Link>
										</div>
									</div>
									{view === "html" ? (
										<iframe
											title={selected.subject}
											src={previewHref(base, selected.name, locale, "html")}
											mix={[grow(), is("full"), minBs("70dvh"), border("none"), bg("white")]}
										/>
									) : (
										<pre
											mix={[
												grow(),
												m(0),
												p(5),
												overflowY("auto"),
												whiteSpace("pre-wrap"),
												font("mono"),
												fontSize("sm"),
											]}
										>
											{text}
										</pre>
									)}
								</>
							)}
						</main>
					</div>
				</body>
			</html>
		);
	};
}

export default previews;
