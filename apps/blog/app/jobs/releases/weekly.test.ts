/**
 * Tests the weekly releases job against a migrated in-memory database and a GitHub and
 * WebSub hub answered by MSW: a week with packages publishes one post and sends it out, a
 * rerun leaves it alone, an empty week posts nothing, and a GitHub failure retries the run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database as DataTable } from "remix/data-table";

import { Database } from "@sdxc/database-middleware";
import { createJobContext, Job } from "@sdxc/jobs";
import { unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
	vi,
} from "vite-plus/test";

import type { ApiRelease } from "~/app/test/github-releases";

import jobs from "~/app/jobs";
import { testDatabase } from "~/app/test/database";
import { seedAuthor } from "~/app/test/fixtures";
import { apiRelease, MONOREPO_SINGLE_BODY } from "~/app/test/github-releases";
import { bindModels, publishModels } from "~/app/test/models";
import { RELEASE_SOURCES } from "~/config/releases";

/** The hub the job pings once a post is written. */
const HUB = "https://hub.example.com/";

/** The environment the job reads, which a test changes in place. */
let workerEnv: { GITHUB_TOKEN?: string; WEBSUB_HUB: string } = {
	GITHUB_TOKEN: "token",
	WEBSUB_HUB: HUB,
};

/** Every job the handler queued, standing in for the queue the dispatcher writes to. */
let enqueued = vi.fn<(job: { name: string }, input: unknown) => Promise<void>>(async () => {});

vi.doMock("cloudflare:workers", () => ({ env: workerEnv, waitUntil: () => {} }));
vi.doMock("~/app/initializers/dispatcher", () => ({ dispatcher: { enqueue: enqueued } }));

let weekly = (await import("./weekly")).default;

/** A run on the Friday closing `2026-w42`. */
const NOW = new Date("2026-10-16T17:00:30Z");

/** Every repository's releases, by `owner/name`; GitHub refuses a repository missing here. */
let listed: Record<string, ApiRelease[]> = {};

/** The topics each hub ping named. */
let pings: string[][] = [];

let server = setupServer(
	http.get("https://api.github.com/repos/:owner/:name/releases", ({ params, request }) => {
		let repository = `${String(params.owner)}/${String(params.name)}`;
		let page = new URL(request.url).searchParams.get("page") ?? "1";
		if (listed[repository] === undefined) {
			return new HttpResponse(null, { status: 503 });
		}
		return HttpResponse.json(page === "1" ? (listed[repository] ?? []) : []);
	}),
	http.post(HUB, async ({ request }) => {
		pings.push(new URLSearchParams(await request.text()).getAll("hub.url"));
		return new HttpResponse(null, { status: 204 });
	}),
);

let db: DataTable;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

beforeEach(async () => {
	vi.useFakeTimers({ toFake: ["Date"], now: NOW });
	enqueued.mockClear();
	pings = [];
	workerEnv.GITHUB_TOKEN = "token";
	listed = Object.fromEntries(RELEASE_SOURCES.map((source) => [source.repository, []]));
	db = await testDatabase();
	let author = await seedAuthor(db);
	unwrap(await bindModels(db).users.update(author, { role: "admin" }));
});

afterEach(() => vi.useRealTimers());

/** Runs the job the way the dispatcher would after its middleware. */
async function run(): Promise<void> {
	let ctx = createJobContext(jobs.releases.weekly, { id: "m", attempts: 1 });
	ctx.set(Database, db, { property: "db" });
	publishModels(ctx, db);
	await weekly(ctx);
}

/** A week in which the monorepo released one package. */
function releasedThisWeek() {
	listed["sergiodxa/monorepo"] = [
		apiRelease("sergiodxa/monorepo", "v2026.10.14", "2026-10-14T03:00:00Z", {
			body: MONOREPO_SINGLE_BODY,
		}),
	];
}

describe("the weekly releases job", () => {
	test("publishes the week's post and sends it out like a created post", async () => {
		releasedThisWeek();

		await run();

		let post = await bindModels(db).releases.findBySlug("2026-w42");
		expect(post?.meta.packages.map((pkg) => pkg.name)).toEqual(["@sdxc/spec"]);
		expect(enqueued.mock.calls.map(([job, input]) => [job.name, input])).toEqual([
			[jobs.webmentions.send.name, { postId: post?.id }],
			[jobs.activityPub.publish.name, { postId: post?.id, changedAt: NOW.toISOString() }],
		]);
		expect(pings).toEqual([
			[
				"https://sergiodxa.com/rss",
				"https://sergiodxa.com/atom.xml",
				"https://sergiodxa.com/feed.json",
				"https://sergiodxa.com/releases.rss",
				"https://sergiodxa.com/releases.atom",
				"https://sergiodxa.com/releases.json",
			],
		]);
	});

	test("leaves a week that already has its post alone on a rerun", async () => {
		releasedThisWeek();
		await run();
		enqueued.mockClear();

		await run();

		expect(await bindModels(db).releases.findAll()).toHaveLength(1);
		expect(enqueued).not.toHaveBeenCalled();
	});

	test("posts nothing for a week without a released package", async () => {
		await run();

		expect(await bindModels(db).releases.findAll()).toEqual([]);
		expect(enqueued).not.toHaveBeenCalled();
	});

	test("retries the run when a repository cannot be read", async () => {
		releasedThisWeek();
		delete listed["sergiodxa/remix-auth"];

		await expect(run()).rejects.toBeInstanceOf(Job.Retry);
		expect(await bindModels(db).releases.findAll()).toEqual([]);
	});
});
