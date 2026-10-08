/**
 * The package entry point: `EPUB.build` turns metadata, XHTML chapters and resources into an
 * EPUB 3.3 publication checked against what epubcheck rejects, and the error classes say which
 * rule an input broke. It runs wherever Web Streams do and does no work at import time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export { EPUB } from "./epub.js";
export {
	EpubContentError,
	EpubError,
	EpubMediaTypeError,
	EpubMetadataError,
	EpubMissingResourceError,
	EpubPathError,
	EpubRemoteResourceError,
} from "./errors.js";
