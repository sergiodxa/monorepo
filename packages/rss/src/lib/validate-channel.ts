/**
 * Validates that an RSS channel carries the fields RSS 2.0 requires.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { RSS } from "../index.js";

import { RSSParseError } from "../index.js";

/**
 * Ensures a channel carries the title, description and link RSS 2.0 requires.
 *
 * @param channel - The channel value to validate
 * @returns The channel, or an error naming the required fields
 */
export function validateChannel(channel: RSS.Channel): Result<RSS.Channel, RSSParseError> {
	if (!channel.title || !channel.description || !channel.link) {
		return failure(new RSSParseError("Channel must include title, description, and link."));
	}
	return success(channel);
}
