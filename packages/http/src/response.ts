/**
 * Response builders that pair a body with its matching Content-Type
 * header, covering the common content kinds a server returns.
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Location } from "@sdxc/location";

import * as ContentType from "./content-type.js";

/**
 * Creates a Response with JSON content.
 * Uses the built-in Response.json() method for proper serialization.
 * @param body - The value to serialize as JSON
 * @param init - Optional response options (status, headers, etc.)
 * @returns A new Response instance with JSON content
 * @example
 * return json({ success: true, data: [1, 2, 3] });
 * @example
 * return json({ error: "Not found" }, { status: 404 });
 */
export function json<T>(body: T, init?: ResponseInit): Response {
	return Response.json(body, init);
}

/**
 * Creates a Response with plain text content and appropriate Content-Type header.
 * @param body - The text string to send
 * @param init - Optional response options (status, headers, etc.)
 * @returns A new Response instance with plain text content
 * @example
 * return text("Hello, World!");
 * @example
 * return text("Error occurred", { status: 500 });
 */
export function text(body: string, init?: ResponseInit): Response {
	let headers = new Headers(init?.headers);
	headers.set("Content-Type", ContentType.Text);
	return new Response(body, { ...init, headers });
}

/**
 * Creates a Response with HTML content and appropriate Content-Type header.
 * @param body - The HTML string to send
 * @param init - Optional response options (status, headers, etc.)
 * @returns A new Response instance with HTML content
 * @example
 * return html("<h1>Hello World</h1>");
 * @example
 * return html("<h1>Not Found</h1>", { status: 404 });
 */
export function html(body: string, init?: ResponseInit): Response {
	let headers = new Headers(init?.headers);
	headers.set("Content-Type", ContentType.HTML);
	return new Response(body, { ...init, headers });
}

/**
 * Creates a Response with CSS content and appropriate Content-Type header.
 * @param body - The CSS string to send
 * @param init - Optional response options (status, headers, etc.)
 * @returns A new Response instance with CSS content
 * @example
 * return css("body { color: red; }");
 * @example
 * return css(".error { color: red; }", { headers: { "Cache-Control": "max-age=3600" } });
 */
export function css(body: string, init?: ResponseInit): Response {
	let headers = new Headers(init?.headers);
	headers.set("Content-Type", ContentType.CSS);
	return new Response(body, { ...init, headers });
}

/**
 * Creates a Response with JavaScript content and appropriate Content-Type header.
 * @param body - The JavaScript string to send
 * @param init - Optional response options (status, headers, etc.)
 * @returns A new Response instance with JavaScript content
 * @example
 * return javascript("console.log('Hello');");
 * @example
 * return javascript("export default 42;", { headers: { "Cache-Control": "max-age=3600" } });
 */
export function javascript(body: string, init?: ResponseInit): Response {
	let headers = new Headers(init?.headers);
	headers.set("Content-Type", ContentType.JavaScript);
	return new Response(body, { ...init, headers });
}

/**
 * Creates a Response with XML content and appropriate Content-Type header.
 * @param body - The XML string to send
 * @param init - Optional response options (status, headers, etc.)
 * @returns A new Response instance with XML content
 * @example
 * return xml("<root><item>Hello</item></root>");
 * @example
 * return xml("<error>Not found</error>", { status: 404 });
 */
export function xml(body: string, init?: ResponseInit): Response {
	let headers = new Headers(init?.headers);
	headers.set("Content-Type", ContentType.XML);
	return new Response(body, { ...init, headers });
}

/**
 * Creates a Response with `text/csv; charset=utf-8`, for a whole document or one streamed
 * as it is written. The charset parameter is what makes a client decode non-ASCII cells as
 * UTF-8 instead of its locale's legacy encoding.
 * @param body - The CSV document, or a stream of its UTF-8 bytes
 * @param init - Optional response options (status, headers, etc.)
 * @returns A new Response instance with CSV content
 * @example
 * return csv("name,age\nJohn,30\nJane,25");
 * @example
 * return csv(rows, { headers: { "Content-Disposition": attachment("report.csv") } });
 */
export function csv(body: string | ReadableStream<Uint8Array>, init?: ResponseInit): Response {
	let headers = new Headers(init?.headers);
	headers.set("Content-Type", `${ContentType.CSV}; charset=utf-8`);
	return new Response(body, { ...init, headers });
}

/**
 * Creates a Response with Markdown content and appropriate Content-Type header.
 * @param body - The Markdown string to send
 * @param init - Optional response options (status, headers, etc.)
 * @returns A new Response instance with Markdown content
 * @example
 * return markdown("# Hello World\n\nThis is **bold** text.");
 * @example
 * return markdown("# Error\n\nPage not found.", { status: 404 });
 */
export function markdown(body: string, init?: ResponseInit): Response {
	let headers = new Headers(init?.headers);
	headers.set("Content-Type", ContentType.Markdown);
	return new Response(body, { ...init, headers });
}

/**
 * Creates a Response with PDF content and appropriate Content-Type header.
 * Accepts binary data in various formats for flexibility.
 * @param body - The PDF content as Blob, ArrayBuffer, or ReadableStream
 * @param init - Optional response options (status, headers, etc.)
 * @returns A new Response instance with PDF content
 * @example
 * return pdf(pdfBuffer);
 * @example
 * return pdf(pdfBlob, { headers: { "Content-Disposition": "inline; filename=document.pdf" } });
 */
export function pdf(body: Blob | ArrayBuffer | ReadableStream, init?: ResponseInit): Response {
	let headers = new Headers(init?.headers);
	headers.set("Content-Type", ContentType.PDF);
	return new Response(body, { ...init, headers });
}

/**
 * Characters outside printable ASCII, which a quoted `filename` cannot carry. Matched per
 * code point, so an astral character becomes one fallback character.
 */
const NON_PRINTABLE_ASCII = /[^\x20-\x7E]/gu;

/** The two characters a quoted-string must escape with a backslash. */
const QUOTED_STRING_SPECIALS = /["\\]/g;

/** RFC 8187 `attr-char`: the bytes an `ext-value` may carry without percent-encoding. */
const ATTR_CHAR = /^[A-Za-z0-9!#$&+\-.^_`|~]$/;

/**
 * An RFC 8187 `ext-value` for a name, percent-encoding every UTF-8 byte outside
 * `attr-char`. A lone surrogate encodes as U+FFFD, so every string yields a valid value.
 * @param value - The name to encode
 * @returns The value with its `UTF-8''` prefix
 */
function extValue(value: string): string {
	let encoded = "UTF-8''";
	for (let byte of new TextEncoder().encode(value)) {
		let char = String.fromCharCode(byte);
		encoded += ATTR_CHAR.test(char) ? char : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
	}
	return encoded;
}

/**
 * An RFC 6266 `Content-Disposition: attachment` value for a download's file name. Every
 * name gets a quoted ASCII `filename`, with characters outside printable ASCII shown as `_`;
 * such a name also gets an RFC 8187 `filename*`, which clients prefer, carrying it exactly.
 * @param filename - The name the download is saved as
 * @returns The header value
 * @example
 * attachment("report.csv"); // 'attachment; filename="report.csv"'
 * @example
 * attachment("Café.csv"); // "attachment; filename=\"Caf_.csv\"; filename*=UTF-8''Caf%C3%A9.csv"
 */
export function attachment(filename: string): string {
	let fallback = filename.replaceAll(NON_PRINTABLE_ASCII, "_");
	let value = `attachment; filename="${fallback.replaceAll(QUOTED_STRING_SPECIALS, "\\$&")}"`;
	if (fallback !== filename) value += `; filename*=${extValue(filename)}`;
	return value;
}

/**
 * Creates a Response for a file download, with the name written by `attachment` so a quote
 * or a non-ASCII character in it reaches the client intact.
 * @param body - The file content as Blob, ArrayBuffer, or ReadableStream
 * @param filename - The filename to suggest for the download
 * @param init - Optional response options (status, headers, etc.)
 * @returns A new Response instance configured for file download
 * @example
 * return file(zipBuffer, "archive.zip");
 * @example
 * return file(imageBlob, "photo.png", { headers: { "Cache-Control": "no-store" } });
 */
export function file(
	body: Blob | ArrayBuffer | ReadableStream,
	filename: string,
	init?: ResponseInit,
): Response {
	let headers = new Headers(init?.headers);
	headers.set("Content-Type", ContentType.OctetStream);
	headers.set("Content-Disposition", attachment(filename));
	return new Response(body, { ...init, headers });
}

/**
 * Creates a Response for Server-Sent Events (SSE) streaming.
 * Sets appropriate headers for SSE including Cache-Control and Connection.
 * @param body - The ReadableStream producing SSE events
 * @param init - Optional response options (status, headers, etc.)
 * @returns A new Response instance configured for SSE streaming
 * @example
 * return stream(new ReadableStream({ start(controller) { controller.enqueue("data: hello\n\n"); } }));
 * @example
 * return stream(eventStream, { headers: { "X-Custom-Header": "value" } });
 */
export function stream(body: ReadableStream, init?: ResponseInit): Response {
	let headers = new Headers(init?.headers);
	headers.set("Content-Type", ContentType.EventStream);
	headers.set("Cache-Control", "no-cache");
	headers.set("Connection", "keep-alive");
	return new Response(body, { ...init, headers });
}

/**
 * Creates a 204 No Content response with no body.
 * Used when an operation succeeds but has no content to return.
 * @param init - Optional response options (headers, etc.) - status is always 204
 * @returns A new Response instance with 204 status and no body
 * @example
 * return noContent();
 * @example
 * return noContent({ headers: { "X-Request-Id": "abc123" } });
 */
export function noContent(init?: Omit<ResponseInit, "status" | "statusText">): Response {
	return new Response(null, { ...init, status: 204, statusText: "No Content" });
}

/**
 * Creates a redirect response to the specified target URL or Location.
 * Validates the target and defaults to 307 Temporary Redirect status.
 * @param target - The URL, Location, or string to redirect to
 * @param init - Optional response options including redirect status
 * @returns A new Response instance with redirect status and Location header
 * @throws Error if the target is not a valid URL or Location
 * @example
 * return redirect("/dashboard");
 * @example
 * return redirect(new URL("https://example.com"), { status: redirect.Status.Permanent });
 */
export function redirect(target: URL | Location | string, init?: redirect.Init): Response {
	if (!Location.canParse(target)) {
		throw new Error(`Invalid redirect target: ${String(target)}`);
	}

	let headers = new Headers(init?.headers);
	headers.set("Location", String(target));

	let status = init?.status ?? redirect.Status.Temporary;

	return new Response(null, { ...init, status, headers });
}

export namespace redirect {
	/** Use for POST-Redirect-GET pattern. Always changes method to GET. */
	export enum Status {
		/** Use for POST-Redirect-GET pattern. Always changes method to GET. */
		SeeOther = 303,
		/** Temporary redirect that preserves HTTP method. */
		Temporary = 307,
		/** Permanent redirect that preserves HTTP method. */
		Permanent = 308,
	}

	export type Init = Omit<ResponseInit, "status" | "statusText"> & {
		status?: Status;
	};
}
