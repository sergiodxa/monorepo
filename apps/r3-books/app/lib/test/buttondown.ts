/**
 * Test-only fake newsletter client. Records what it was asked to do and answers from a
 * scripted state, so a controller test can assert on the funnel's behavior — who gets
 * subscribed, who gets tagged, which error copy a visitor sees — without a network layer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SubscribeAttribution } from "~/app/services/buttondown";

import { Buttondown, ButtondownError } from "~/app/services/buttondown";

/** How the fake should answer, and what it recorded. */
export interface FakeButtondownOptions {
	/** Addresses the fake already knows, so `isSubscribed` answers `true`. */
	subscribed?: string[];
	/** When set, `subscribe` throws a {@link ButtondownError} with this code. */
	failWith?: string;
	/** When set, `subscribe` throws this error instead of a provider error. */
	throws?: Error;
}

/**
 * A {@link Buttondown} stand-in. Extends the real class so it satisfies the container's
 * class key, but overrides every method and never constructs a request.
 */
export class FakeButtondown extends Buttondown {
	/** Addresses passed to `subscribe`, in order. */
	readonly subscribed: Array<{ email: string; attribution: SubscribeAttribution }> = [];
	/** Metadata patches applied, in order. */
	readonly tagged: Array<{ email: string; metadata: Record<string, string> }> = [];

	private readonly known: Set<string>;
	private readonly failWith?: string;
	private readonly throws?: Error;

	/**
	 * @param options - Scripted answers for this fake.
	 */
	constructor(options: FakeButtondownOptions = {}) {
		super({ apiKey: "fake" });
		this.known = new Set(options.subscribed ?? []);
		this.failWith = options.failWith;
		this.throws = options.throws;
	}

	/** @returns Whether the address was listed as already subscribed. */
	override async isSubscribed(email: string): Promise<boolean> {
		return this.known.has(email);
	}

	/** Records the subscription, or fails with whatever the test scripted. */
	override async subscribe(email: string, attribution: SubscribeAttribution): Promise<void> {
		if (this.throws) throw this.throws;
		if (this.failWith) throw new ButtondownError("scripted failure", this.failWith);
		this.subscribed.push({ email, attribution });
		this.known.add(email);
	}

	/** Records the metadata patch. */
	override async addMetadata(email: string, metadata: Record<string, string>): Promise<void> {
		this.tagged.push({ email, metadata });
	}
}
