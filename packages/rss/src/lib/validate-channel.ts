/**
 * Validates that an RSS channel carries the fields RSS 2.0 requires.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RSS } from "../index";

/**
 * Ensures channel updates preserve the required RSS 2.0 fields.
 *
 * @param channel - The channel value to validate
 */
export function validateChannel(channel: RSS.Channel): void {
	if (!channel.title || !channel.description || !channel.link) {
		throw new Error("Channel must include title, description, and link.");
	}
}
