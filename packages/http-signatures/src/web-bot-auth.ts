/**
 * Web Bot Auth (draft-ietf-webbotauth-httpsig-protocol): automated clients sign requests
 * with RFC 9421 and publish their keys at a well-known directory, so any origin can tell
 * one bot from another by a URL it verified rather than a User-Agent it was told.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { SignDirectoryOptions } from "./web-bot-auth/directory.js";
export type { WebBotAuthKey } from "./web-bot-auth/key.js";
export type { WebBotAuthSignOptions } from "./web-bot-auth/sign.js";
export type { SignatureAgent } from "./web-bot-auth/signature-agent.js";
export type { WebBotAuthVerified, WebBotAuthVerifyOptions } from "./web-bot-auth/verify.js";

export { DIRECTORY_TAG, signDirectoryResponse } from "./web-bot-auth/directory.js";
export { importWebBotAuthKey } from "./web-bot-auth/key.js";
export { signWebBotAuth, WEB_BOT_AUTH_TAG, webBotAuthSigner } from "./web-bot-auth/sign.js";
export { parseSignatureAgent, stringifySignatureAgent } from "./web-bot-auth/signature-agent.js";
export { DIRECTORY_CACHE_PREFIX, verifyWebBotAuth } from "./web-bot-auth/verify.js";
