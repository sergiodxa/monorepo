/**
 * The Micropub media endpoint: reads the one `file` part an upload carries, checked for
 * size and media type, and answers with the URL the file is stored at, so a client can
 * reference it in a later create.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import { mediaTypeEssence } from "./lib/body.js";
import { MicropubRequestError } from "./lib/errors.js";
import { created } from "./lib/responses.js";
import { requestToken } from "./lib/token.js";

import type { Micropub } from "./index.js";

const DEFAULT_MAX_BYTES = 26_214_400;

/**
 * Groups the media endpoint types under a single import surface.
 */
export namespace Media {
	/** What an upload must be; the size is checked again here for a router without a parse cap. */
	export interface Options {
		/** The multipart body, already read by middleware or by the caller. */
		formData: FormData;
		/** @default 26_214_400 */
		maxBytes?: number;
		/** Media types accepted, matched on the essence; `image/*` and `*\/*` wildcards allowed. */
		accept: string[];
	}
}

/**
 * The single `file` part the spec requires, with the access token from the header or
 * the form. A missing, textual or repeated `file`, an oversized file and a type outside
 * `accept` are all `invalid_request`.
 *
 * @returns The file with its token, or why the upload is invalid
 */
export function parseUpload(
	request: Request,
	options: Media.Options,
): Result<Micropub.Parsed<File>, MicropubRequestError> {
	let token = requestToken(request, options.formData);
	if (isFailure(token)) return token;
	let parts = options.formData.getAll("file");
	if (parts.length !== 1) {
		return failure(
			new MicropubRequestError(
				parts.length === 0
					? "The upload has no part named file."
					: "The upload must carry exactly one part named file.",
			),
		);
	}
	let [file] = parts;
	if (!(file instanceof File)) {
		return failure(new MicropubRequestError("The file part must be a file, not text."));
	}
	let maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
	if (file.size > maxBytes) {
		return failure(new MicropubRequestError(`The file is larger than ${maxBytes} bytes.`));
	}
	let type = mediaTypeEssence(file.type);
	if (!options.accept.some((pattern) => matchesType(type, pattern))) {
		return failure(
			new MicropubRequestError(`Files of type ${type || "unknown"} are not accepted.`),
		);
	}
	return success({ body: file, accessToken: token.data });
}

/** `201 Created` with the file's public URL in `Location`. */
export function uploaded(location: string | URL): Response {
	return created(location);
}

/** Whether a media type essence matches an accepted pattern; an untyped file matches only `*\/*`. */
function matchesType(type: string, pattern: string): boolean {
	let accepted = mediaTypeEssence(pattern);
	if (accepted === "*/*") return true;
	if (type === "") return false;
	if (accepted.endsWith("/*")) return type.startsWith(accepted.slice(0, -1));
	return type === accepted;
}
