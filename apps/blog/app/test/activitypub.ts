/**
 * Threads-pool test support for federation: the blog's federation over a test database with
 * keys generated per run, an in-memory document cache and queue, a remote Mastodon account
 * with its own keys, and the MSW handlers that let the outbound DNS check pass.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Federation } from "@sdxc/activitypub";
import type { Database } from "remix/data-table";

import { ActorKeys } from "@sdxc/activitypub";
import { MemoryCache } from "@sdxc/cache/memory";
import { unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";

import { createFederation } from "~/app/services/activitypub";
import { ACTOR_ID } from "~/config/activitypub";

/** The remote account every federation test follows, replies and reacts as. */
export const ALICE = "https://mastodon.social/users/alice";

/** Alice's server's shared inbox, where deliveries to her and her neighbours go. */
export const ALICE_SHARED_INBOX = "https://mastodon.social/inbox";

/**
 * A fresh RSA key pair for an actor.
 *
 * @param actor The actor the keys sign as.
 */
export async function keysFor(actor: string): Promise<ActorKeys> {
	let generated = unwrap(await ActorKeys.generate());
	return unwrap(await ActorKeys.import({ actor, privateKeyPem: generated.privateKeyPem }));
}

/** A federation queue holding what it was given, which a test hands back to `process`. */
export class TestQueue implements Federation.Queue {
	readonly messages: Federation.Message[] = [];

	/** Holds one message. */
	async enqueue(message: Federation.Message): Promise<void> {
		this.messages.push(message);
	}

	/** Holds every message, in order. */
	async enqueueMany(messages: Federation.Message[]): Promise<void> {
		this.messages.push(...messages);
	}

	/** Removes and answers every message held so far. */
	take(): Federation.Message[] {
		return this.messages.splice(0);
	}
}

/**
 * The blog's federation over `db`, signing with `keys`, caching documents in memory and
 * queueing into `queue`, so nothing reads the Secrets Store, KV or the job queue.
 *
 * @param db The test's database.
 * @param keys The blog actor's keys.
 * @param queue Where its messages go.
 */
export function testFederation(
	db: Database,
	keys: ActorKeys,
	queue: Federation.Queue = new TestQueue(),
): Federation {
	return createFederation({ db, cache: new MemoryCache(), keys, queue });
}

/** The blog actor's keys, generated once per test file. */
export function blogKeys(): Promise<ActorKeys> {
	return keysFor(ACTOR_ID);
}

/**
 * Alice's actor document, publishing `keys` as her `#main-key`.
 *
 * @param keys Alice's keys.
 */
export function aliceDocument(keys: ActorKeys): Record<string, unknown> {
	return {
		"@context": ["https://www.w3.org/ns/activitystreams", "https://w3id.org/security/v1"],
		id: ALICE,
		type: "Person",
		preferredUsername: "alice",
		name: "Alice",
		url: "https://mastodon.social/@alice",
		inbox: `${ALICE}/inbox`,
		outbox: `${ALICE}/outbox`,
		followers: `${ALICE}/followers`,
		endpoints: { sharedInbox: ALICE_SHARED_INBOX },
		icon: { type: "Image", url: "https://files.mastodon.social/alice.png", mediaType: "image/png" },
		publicKey: keys.publicKey,
	};
}

/** Every name resolves to one public address, so the outbound DNS check lets requests through. */
export function publicDns() {
	return http.get("https://cloudflare-dns.com/dns-query", ({ request }) => {
		let url = new URL(request.url);
		let name = url.searchParams.get("name") ?? "";
		let asksA = url.searchParams.get("type") !== "AAAA";
		return HttpResponse.json({
			Status: 0,
			Answer: asksA ? [{ name, type: 1, TTL: 60, data: "93.184.216.34" }] : [],
		});
	});
}

/**
 * Serves `json` at `url` as ActivityStreams.
 *
 * @param url Where the document lives.
 * @param json The document.
 */
export function serveDocument(url: string, json: Record<string, unknown>) {
	return http.get(url, () =>
		HttpResponse.json(json, { headers: { "content-type": "application/activity+json" } }),
	);
}
