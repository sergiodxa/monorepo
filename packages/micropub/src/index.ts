/**
 * Reads Micropub requests (form-encoded, multipart and JSON) into typed operations and
 * queries, and builds the responses the W3C Recommendation defines, so an endpoint maps
 * one validated operation onto its content and verifies one access token string.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { MF2 } from "@sdxc/microformats";

export { MicropubRequestError } from "./lib/errors.js";
export { parseOperation, requiredScopes } from "./lib/operation.js";
export { parseQuery } from "./lib/query.js";
export {
	accepted,
	categories,
	config,
	created,
	deleted,
	error,
	source,
	syndicateTo,
	updated,
} from "./lib/responses.js";

/**
 * Groups the Micropub request and response types under a single import surface.
 */
export namespace Micropub {
	/** Property names as spelled on the wire (`in-reply-to`), each with its mf2 values. */
	export type Properties = Record<string, MF2.PropertyValue[]>;

	/** The `mp-*` commands of a create, which instruct the server and never become properties. */
	export interface Commands {
		/** `mp-slug`, the path segment the client suggests. */
		slug: string | null;
		/** `mp-syndicate-to`, the `uid`s of the targets `q=syndicate-to` listed. */
		syndicateTo: string[];
		/** `post-status`, which is a property on the wire and a command in effect. */
		status: "published" | "draft" | null;
		/** Every other `mp-*` name, spelled with its prefix, kept for the app to honor or ignore. */
		other: Record<string, unknown[]>;
	}

	/** A new post; `access_token`, `h` and the commands are already split out of `properties`. */
	export interface Create {
		action: "create";
		/** `["h-entry"]` when the client named no type, as the specification defaults it. */
		type: string[];
		properties: Properties;
		commands: Commands;
		/** Files from a multipart create, by property name (`photo`, `video`, `audio`). */
		files: Record<string, File[]>;
	}

	/** Changes to an existing post; at least one of the four holds an entry. */
	export interface Update {
		action: "update";
		url: string;
		/** Every value of each property is replaced; a missing property is created. */
		replace: Properties;
		/** Values appended to each property; a missing property is created. */
		add: Properties;
		/** Properties removed entirely. */
		deleteProperties: string[];
		/** Individual values removed from a property; one left empty is removed. */
		deleteValues: Properties;
	}

	/** Removes the post at `url`. */
	export interface Delete {
		action: "delete";
		url: string;
	}

	/** Restores a post a `Delete` removed. */
	export interface Undelete {
		action: "undelete";
		url: string;
	}

	/** Every write a Micropub POST can carry. */
	export type Operation = Create | Update | Delete | Undelete;

	/** `q=config`: what the server supports. */
	export interface ConfigQuery {
		q: "config";
	}

	/** `q=syndicate-to`: the targets a create may name in `mp-syndicate-to`. */
	export interface SyndicateToQuery {
		q: "syndicate-to";
	}

	/** `q=source`: a post handed back for editing. */
	export interface SourceQuery {
		q: "source";
		url: string;
		/** The `properties[]` requested; empty asks for the whole item with its `type`. */
		properties: string[];
	}

	/** `q=category`, the widely implemented extension listing the tags in use. */
	export interface CategoryQuery {
		q: "category";
		/** The prefix a client typed, to narrow the list. */
		filter: string | null;
	}

	/** Any other `q`, which the specification leaves to extensions; `name` is the `q` sent. */
	export interface ExtensionQuery {
		q: "extension";
		name: string;
		params: URLSearchParams;
	}

	/** Every query a Micropub GET can carry, discriminated on `q`. */
	export type Query = ConfigQuery | SyndicateToQuery | SourceQuery | CategoryQuery | ExtensionQuery;

	/** A decoded request body together with the credential sent with it. */
	export interface Parsed<Body> {
		body: Body;
		/** From `Authorization: Bearer` or the form's `access_token`; `null` when neither was sent. */
		accessToken: string | null;
	}

	/** The scopes Micropub servers grant; `undelete` and `draft` are common extensions. */
	export type Scope = "create" | "update" | "delete" | "undelete" | "media" | "draft";

	/** A service or account a syndication target names, shown beside it in a client. */
	export interface SyndicationDetail {
		name: string;
		url?: string;
		photo?: string;
	}

	/** Somewhere a post can be syndicated; `uid` is opaque to clients and `name` is displayed. */
	export interface SyndicationTarget {
		uid: string;
		name: string;
		service?: SyndicationDetail;
		user?: SyndicationDetail;
	}

	/** A post type the server accepts, as the `post-types` extension lists it. */
	export interface PostType {
		/** The Post Type Discovery name (`note`, `article`, `photo`). */
		type: string;
		name: string;
	}

	/** The `q=config` answer; every member is optional, and an empty config is `{}`. */
	export interface Config {
		mediaEndpoint?: string;
		syndicateTo?: SyndicationTarget[];
		/** Queries this server answers besides `config`. */
		q?: string[];
		postTypes?: PostType[];
	}

	/** The error codes the specification defines, each with its own status. */
	export type ErrorCode = "invalid_request" | "unauthorized" | "forbidden" | "insufficient_scope";

	/** Extra members of an error response. */
	export interface ErrorDetails {
		/** The scopes that would authorize the request, sent with `insufficient_scope`. */
		scope?: string[];
	}

	/** How `parseOperation` reads the request body. */
	export interface ParseOptions {
		/** The body `formData()` middleware already read, for form and multipart requests. */
		formData?: FormData;
		/** @default 1_048_576 */
		maxJsonBytes?: number;
	}
}
