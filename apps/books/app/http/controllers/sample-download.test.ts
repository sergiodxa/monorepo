/**
 * Tests for `/sample/download` — the EPUB behind the signed link. A link the unlocked page
 * minted downloads the file; an expired, altered or missing one goes back to the form, which
 * is the only place a new link comes from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MemoryNewsletter } from "@sdxc/newsletter/memory";
import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { readSampleEpub } from "~/app/lib/sample-chapter";
import { SAMPLE_LINK_TTL_SECONDS, signSampleLink } from "~/app/lib/sample-link";
import { fetchApp } from "~/app/lib/test/router";

/** A freshly minted link, failing the test when signing fails. */
async function link(now?: Date): Promise<string> {
	let signed = await signSampleLink(now);
	if (isFailure(signed)) throw signed.error;
	return signed.data;
}

/** The text of one file of the built EPUB. */
function epubFile(path: string): string {
	let epub = readSampleEpub();
	if (isFailure(epub)) throw epub.error;
	let file = epub.data.files.find((candidate) => candidate.path === path);
	if (!file) throw new Error(`No ${path} in the EPUB`);
	return new TextDecoder().decode(file.bytes);
}

describe("GET /sample/download", () => {
	test("serves the EPUB for a link the unlocked page minted", async () => {
		let page = await fetchApp("/sample", {
			method: "POST",
			body: new URLSearchParams({ email: "reader@example.com" }),
			newsletter: new MemoryNewsletter(),
		}).then((response) => response.text());
		let href = page.match(/href="(\/sample\/download\?[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
		expect(href).toBeDefined();

		let response = await fetchApp(href ?? "");
		let bytes = new Uint8Array(await response.arrayBuffer());

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/epub+zip");
		expect(response.headers.get("content-disposition")).toBe(
			'attachment; filename="oauth2-handbook-sample.epub"',
		);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(new TextDecoder().decode(bytes.subarray(0, 2))).toBe("PK");
		expect(new TextDecoder().decode(bytes.subarray(30, 58))).toBe("mimetypeapplication/epub+zip");
	});

	test("sends an expired link back to the form", async () => {
		let expired = await link(new Date(Date.now() - (SAMPLE_LINK_TTL_SECONDS + 60) * 1000));

		let response = await fetchApp(expired);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("/sample");
	});

	test("sends a link with an altered expiry or signature back to the form", async () => {
		let url = new URL(await link(), "https://books.test");
		let later = new URL(url);
		later.searchParams.set("expires", String(Number(url.searchParams.get("expires")) + 3600));
		let forged = new URL(url);
		forged.searchParams.set("signature", "0".repeat(64));

		for (let tampered of [later, forged]) {
			let response = await fetchApp(`${tampered.pathname}${tampered.search}`);
			expect(response.status).toBe(303);
			expect(response.headers.get("location")).toBe("/sample");
		}
	});

	test.each([
		["/sample/download"],
		["/sample/download?expires=soon&signature=abc"],
		["/sample/download?signature=abc"],
	])("sends %s back to the form", async (path) => {
		let response = await fetchApp(path);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("/sample");
	});
});

describe("the sample EPUB", () => {
	test("builds from the bundled chapter, with its code and cover", () => {
		let chapter = epubFile("EPUB/text/oauth2-simple-terms.xhtml");

		expect(chapter).toContain("<h1>OAuth2 in Simple Terms</h1>");
		expect(chapter).toContain('<h2 id="section-why-oauth2">Why OAuth2?</h2>');
		expect(chapter).toContain('class="token ');
		expect(chapter).toContain('href="../styles/book.css"');
		expect(epubFile("EPUB/cover.xhtml")).toContain('src="images/cover.jpg"');
	});

	test("nests every ### under its ## in the table of contents", () => {
		let nav = epubFile("EPUB/nav.xhtml");

		expect(nav).toContain('<a href="text/oauth2-simple-terms.xhtml#section-actors-in-oauth2">');
		expect(nav).toMatch(
			/section-actors-in-oauth2">Actors in OAuth2<\/a>\s*<ol>\s*<li>\s*<a href="text\/oauth2-simple-terms\.xhtml#section-resource-owner">/,
		);
	});

	test("keeps one identifier across builds and carries accessibility metadata", () => {
		let opf = epubFile("EPUB/package.opf");

		expect(opf).toContain(
			'<dc:identifier id="pub-id">urn:uuid:3f6c9a52-8d1e-4b7a-9c3f-5e2d8a1b7c40</dc:identifier>',
		);
		expect(opf).toContain('<meta property="schema:accessibilityHazard">none</meta>');
		expect(opf).toContain('properties="cover-image"');
	});
});
