/**
 * The RFC 9967 event URIs and one builder per event, each producing the `events` claim
 * member a token carries. Provisioning builders pick `full` or `notice` from the payload,
 * so a token can never name one mode and carry the other's attribute.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Events } from "../../events.js";

import { errorDocument } from "../response.js";

/** Every event URI RFC 9967 §7.4 registers. */
export const EVENT_URIS = {
	feedAdd: "urn:ietf:params:scim:event:feed:add",
	feedRemove: "urn:ietf:params:scim:event:feed:remove",
	createFull: "urn:ietf:params:scim:event:prov:create:full",
	createNotice: "urn:ietf:params:scim:event:prov:create:notice",
	patchFull: "urn:ietf:params:scim:event:prov:patch:full",
	patchNotice: "urn:ietf:params:scim:event:prov:patch:notice",
	putFull: "urn:ietf:params:scim:event:prov:put:full",
	putNotice: "urn:ietf:params:scim:event:prov:put:notice",
	delete: "urn:ietf:params:scim:event:prov:delete",
	activate: "urn:ietf:params:scim:event:prov:activate",
	deactivate: "urn:ietf:params:scim:event:prov:deactivate",
	asyncResponse: "urn:ietf:params:scim:event:misc:asyncresp",
} as const;

/**
 * A provisioning event in the mode its payload implies: `data` makes the `full` URI,
 * `attributes` the `notice` one, and `version` rides along in either.
 *
 * @param full - The event's `full` URI
 * @param notice - The event's `notice` URI
 * @param change - The payload
 * @returns The event
 */
function provisioning(full: string, notice: string, change: Events.Change): Events.Event {
	let version = change.version === undefined ? {} : { version: change.version };
	if (change.data !== undefined) return { uri: full, payload: { ...version, data: change.data } };
	return { uri: notice, payload: { ...version, attributes: [...change.attributes] } };
}

/**
 * Builders for every RFC 9967 event, passed to `createScimEvent` in its `events` list.
 *
 * @example scimEvents.create({ data: userResource(user, options) })
 * @example scimEvents.patch({ attributes: ["members"], version: 'W/"a330bc54"' })
 * @example scimEvents.asyncResponse({ method: "PUT", status: 200, version: 'W/"huJj29"' })
 */
export const scimEvents = {
	/** The resource joined the feed; it may long predate the event. */
	feedAdd: (): Events.Event => ({ uri: EVENT_URIS.feedAdd, payload: {} }),
	/** The resource left the feed; it may still exist. A deletion sends `delete` alone. */
	feedRemove: (): Events.Event => ({ uri: EVENT_URIS.feedRemove, payload: {} }),
	/** A resource was created, with its server-assigned `id` in `data` or `attributes`. */
	create: (change: Events.Change): Events.Event =>
		provisioning(EVENT_URIS.createFull, EVENT_URIS.createNotice, change),
	/** A resource was patched; a `full` event's `data` is the applied `PatchOp`. */
	patch: (change: Events.Change): Events.Event =>
		provisioning(EVENT_URIS.patchFull, EVENT_URIS.patchNotice, change),
	/** A resource was replaced; a `full` event's `data` is the `PUT` body. */
	put: (change: Events.Change): Events.Event =>
		provisioning(EVENT_URIS.putFull, EVENT_URIS.putNotice, change),
	/** The resource was deleted, and so also left the feed. */
	delete: (): Events.Event => ({ uri: EVENT_URIS.delete, payload: {} }),
	/** The account is ready for use, as publisher and receiver agreed. */
	activate: (): Events.Event => ({ uri: EVENT_URIS.activate, payload: {} }),
	/** The account is disabled; typically its sessions end too. */
	deactivate: (): Events.Event => ({ uri: EVENT_URIS.deactivate, payload: {} }),
	/**
	 * An asynchronous request completed, as the bulk response operation it would have been,
	 * with `status` as a string and a failure's error document as `response`.
	 */
	asyncResponse: (completion: Events.Completion): Events.Event => ({
		uri: EVENT_URIS.asyncResponse,
		payload: {
			method: completion.method,
			...(completion.bulkId === undefined ? {} : { bulkId: completion.bulkId }),
			...(completion.version === undefined ? {} : { version: completion.version }),
			...(completion.location === undefined ? {} : { location: completion.location }),
			status: String(completion.status),
			...(completion.error ? { response: errorDocument(completion.error) } : {}),
		},
	}),
};
