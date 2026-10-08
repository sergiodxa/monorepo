/**
 * Test helpers for reading back what a form did to the in-memory newsletter, so a
 * controller test asserts on the list's state rather than on the calls it received.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MemoryNewsletter } from "@sdxc/newsletter/memory";

import { unwrap } from "@sdxc/result";

/**
 * Reads every address on the list, in the order the list received them.
 *
 * @param newsletter - The list a test installed.
 * @returns The stored addresses.
 * @example expect(await subscribed(newsletter)).toEqual(["reader@example.com"]);
 */
export async function subscribed(newsletter: MemoryNewsletter): Promise<string[]> {
	let page = await unwrap(newsletter.subscribers.list());
	return page.items.map((subscriber) => subscriber.email);
}
