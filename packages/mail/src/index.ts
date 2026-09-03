/**
 * Transport-agnostic transactional mail: the message contract, the mailer that
 * normalizes and delivers it, the rendering layer that turns a `remix/ui` tree into
 * both body parts, and the unbranded layout kit for authoring one. Transports live
 * behind their own subpaths so importing one never pulls another's dependency.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Email as EmailContract } from "./types.js";

import * as EmailComponents from "./components.js";

export type { Address, Message, NormalizedMessage, SentMessage, Transport } from "./types.js";
export type { MailerOptions, SendOptions } from "./mailer.js";
export type { RenderedEmail } from "./render.js";

/**
 * One row of an `Email.Table`. Exported under its own name because `Email` is a type
 * alias in type space and a namespace object in value space, so `Email.Table.Row` only
 * resolves in the second of those and an author writing the rows out needs the first.
 */
export type EmailTableRow = EmailComponents.Table.Row;

/** A web font for `Email.Layout` to declare, named here for the same reason as above. */
export type EmailFont = EmailComponents.Font;

export { MailError } from "./errors.js";
export { formatAddress, toAddressList } from "./lib/address.js";
export { htmlToText } from "./lib/html-to-text.js";
export { isEmail, Mailer } from "./mailer.js";
export { buildMimeMessage } from "./mime.js";
export { render } from "./render.js";

/**
 * An email authored as a class: who it goes to, what it says, and what it
 * looks like, handed straight to `send()` or `later()`. Declared as an alias
 * so it can share the `Email` identifier with the layout kit below.
 */
export type Email = EmailContract;

/**
 * Layout kit for email bodies, addressed as `Email.*` because this namespace
 * shares its identifier with the `Email` type contract above. `Markdown` and
 * `CodeBlock` live behind `@sdxc/mail/markdown` instead, shipped only where imported.
 */
export const Email = EmailComponents;
