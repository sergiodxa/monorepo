/**
 * The bounded retrieval on its own, for any client fetching a URL a stranger chose:
 * public hosts only, re-checked on every redirect hop, a byte cap counted off the
 * stream, and one deadline for the whole chain.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { Read, Retrieved, RetrieveOptions } from "./lib/limits.js";

export {
	addressable,
	follow,
	isAddressableHost,
	MAX_BYTES,
	MAX_REDIRECTS,
	readWithin,
	release,
	retrieve,
	TIMEOUT_MS,
} from "./lib/limits.js";

export { DistillLimitError, DistillRefusedError } from "./index.js";
