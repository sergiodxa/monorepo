/**
 * Tests the blog demos through the real router: every blog's feed, posts, archive, topics,
 * search, about, sign-up, RSS and 404 answer, every post parses, every link a page draws
 * resolves, and the feed stays one mixed stream that `?type=` narrows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseDocument } from "@sdxc/html/document";
import { unwrap } from "@sdxc/result";
import { isSuccess } from "@sdxc/result";
import { RSS } from "@sdxc/rss";
import { describe, expect, test } from "vitest";

import { listPosts } from "~/app/services/demo-blogs";
import { fetchApp } from "~/app/test/router";
import { demoBlogHref, findDemoBlogSite, listDemoBlogSlugs } from "~/resources/views/demo-blogs";

/** Every blog with its posts, loaded once for the table-driven tests below. */
let blogs = await Promise.all(
	listDemoBlogSlugs().map(async (slug) => {
		let site = (await findDemoBlogSite(slug))!;
		return { slug, site, posts: await listPosts(site) };
	}),
);

/** Reads a page's body as a document. */
async function read(path: string) {
	let response = await fetchApp(path);
	return { response, page: unwrap(parseDocument(await response.text())) };
}

describe.each(blogs)("the $slug blog demo", ({ posts, site, slug }) => {
	let href = demoBlogHref(slug);

	test("reads every post file, each under one of the blog's kinds", () => {
		expect(posts.length).toBe(Object.keys(site.posts).length);
		for (let post of posts) expect(Object.keys(site.kinds)).toContain(post.kind);
	});

	test("keeps every kind and a series in its posts, so each row shape has something to draw", () => {
		for (let kind of Object.keys(site.kinds)) {
			expect(
				posts.some((post) => post.kind === kind),
				kind,
			).toBe(true);
		}
		expect(posts.some((post) => post.series !== undefined)).toBe(true);
	});

	test("answers its feed noindex, mixing every kind on the first page", async () => {
		let { page, response } = await read(href());
		expect(response.status).toBe(200);
		expect(page.querySelector('meta[name="robots"]')?.getAttribute("content")).toContain("noindex");
		let text = page.body?.textContent ?? "";
		let firstPage = posts.slice(0, site.pageSize + 1);
		let kinds = new Set(firstPage.map((post) => post.kind));
		expect(kinds.size).toBeGreaterThan(1);
		for (let post of posts.slice(0, 3)) expect(text).toContain(post.title);
	});

	test("narrows the same feed to one kind with ?type=", async () => {
		let kind = Object.keys(site.kinds).find((entry) => entry !== posts[0]!.kind)!;
		let others = new Set(posts.filter((post) => post.kind !== kind).map((post) => href(post.path)));
		let count = async (path: string) => {
			let { page } = await read(path);
			let links = Array.from(page.querySelectorAll("a[href]")).map((a) => a.getAttribute("href"));
			return {
				others: links.filter((link) => link !== null && others.has(link)).length,
				links: new Set(links),
			};
		};
		let all = await count(href());
		let narrowed = await count(`${href()}?type=${kind}`);
		expect(narrowed.others).toBeLessThan(all.others);
		for (let post of posts.filter((entry) => entry.kind === kind).slice(0, site.pageSize)) {
			expect(narrowed.links.has(href(post.path)), post.path).toBe(true);
		}
	});

	test("redirects a kind's own address to the feed narrowed to it", async () => {
		let [kind] = Object.keys(site.kinds);
		let response = await fetchApp(href(kind), { redirect: "manual" });
		expect(response.status).toBe(301);
		expect(response.headers.get("Location")).toBe(`${href()}?type=${kind}`);
	});

	test("pages the feed and answers a page past the end with its 404", async () => {
		let pages = Math.ceil(posts.length / site.pageSize);
		if (pages > 1) expect((await fetchApp(`${href()}?page=2`)).status).toBe(200);
		expect((await fetchApp(`${href()}?page=${pages + 1}`)).status).toBe(404);
		expect((await fetchApp(`${href()}?page=zero`)).status).toBe(404);
	});

	test.each(["archive", "tags", "search?q=the", "about", "subscribe", "subscribe?sent=1"])(
		"answers %s",
		async (path) => {
			let response = await fetchApp(`${href()}/${path}`);
			expect(response.status).toBe(200);
		},
	);

	test("answers every post at its kind's address with its title, and every tag", async () => {
		for (let post of posts) {
			let { page, response } = await read(href(post.path));
			expect(response.status, post.path).toBe(200);
			expect(page.querySelector("h1")?.textContent, post.path).toContain(post.title);
		}
		for (let tag of new Set(posts.flatMap((post) => post.tags))) {
			expect((await fetchApp(href(`tags/${tag}`))).status, tag).toBe(200);
		}
	});

	test("gives every heading an article's outline lists an anchor on its page", async () => {
		let article = posts.find((post) => post.featured) ?? posts[0]!;
		let { page } = await read(href(article.path));
		let links = Array.from(page.querySelectorAll('nav[data-toc] a[href^="#"]'));
		for (let link of links) {
			let id = link.getAttribute("href")!.slice(1);
			expect(page.querySelector(`[id="${id}"]`), id).not.toBeNull();
		}
	});

	test("links only to pages that answer", async () => {
		let pages = [href(), href("archive"), href(posts[0]!.path)];
		let seen = new Set<string>();
		for (let path of pages) {
			let { page } = await read(path);
			for (let anchor of Array.from(page.querySelectorAll(`a[href^="${href()}"]`))) {
				let link = anchor.getAttribute("href")!.split("#")[0]!;
				if (seen.has(link)) continue;
				seen.add(link);
				let response = await fetchApp(link, { redirect: "manual" });
				expect([200, 301], link).toContain(response.status);
			}
		}
	});

	test("finds a post by a word in its title", async () => {
		let post = posts.find((entry) => entry.kind === "articles") ?? posts[0]!;
		let word = post.title.split(/\s+/).find((entry) => entry.length > 4) ?? post.title;
		let { page } = await read(`${href("search")}?q=${encodeURIComponent(word)}`);
		expect(page.body?.textContent).toContain(post.title);
	});

	test("answers a missing post with its own 404 inside its frame", async () => {
		let response = await fetchApp(href("articles/no-such-post"));
		expect(response.status).toBe(404);
		expect(await response.text()).toContain(site.name);
	});

	test("serves an RSS feed with every post", async () => {
		let response = await fetchApp(href("rss.xml"));
		expect(response.headers.get("Content-Type")).toContain("application/rss+xml");
		let feed = RSS.parse(await response.text());
		expect(isSuccess(feed)).toBe(true);
		if (isSuccess(feed)) expect(feed.data.items).toHaveLength(posts.length);
	});

	test("takes a sign-up and lands on its confirmation, never on a URL holding the address", async () => {
		let response = await fetchApp(href("subscribe"), {
			method: "POST",
			body: new URLSearchParams({ email: "reader@example.com" }),
			redirect: "manual",
		});
		expect(response.status).toBe(303);
		let location = response.headers.get("Location")!;
		expect(location).toBe(`${href("subscribe")}?sent=1`);
		expect(location).not.toContain("reader");
	});
});

describe("blog demos", () => {
	test("answer a post to any page but the sign-up with 404", async () => {
		let [first] = blogs;
		let response = await fetchApp(demoBlogHref(first!.slug)("about"), {
			method: "POST",
			body: new URLSearchParams({ email: "reader@example.com" }),
		});
		expect(response.status).toBe(404);
	});
});
