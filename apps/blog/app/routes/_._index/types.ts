/**
 * Type definitions for the home feed, declaring the FeedItem interface shared
 * between the feed queries and the FeedList component. It describes each feed
 * entry's id, type, and payload (title, link, createdAt, and published state)
 * so both layers agree on the feed's data shape.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UUID } from "~/utils/uuid";

export interface FeedItem {
	id: UUID;
	type: string;
	payload: { title: string; link: string; createdAt: Date; isPublished: boolean };
}
