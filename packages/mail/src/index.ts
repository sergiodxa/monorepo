/**
 * Transport-agnostic transactional mail: the message contract, the mailer that
 * normalizes and delivers it, the rendering layer that turns a `remix/ui` tree into
 * both body parts, and the unbranded layout kit for authoring one. Transports live
 * behind their own subpaths so importing one never pulls another's dependency.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Email as EmailContract } from "./types";

import * as EmailComponents from "./components";

export type { Address, Message, NormalizedMessage, SentMessage, Transport } from "./types";
export type { MailerOptions, SendOptions } from "./mailer";
export type { RenderedEmail } from "./render";

/**
 * One row of an `Email.Table`. Exported under its own name because `Email` is a type
 * alias in type space and a namespace object in value space, so `Email.Table.Row` only
 * resolves in the second of those and an author writing the rows out needs the first.
 */
export type EmailTableRow = EmailComponents.Table.Row;

export { MailError } from "./errors";
export { formatAddress, toAddressList } from "./lib/address";
export { htmlToText } from "./lib/html-to-text";
export { isEmail, Mailer } from "./mailer";
export { buildMimeMessage } from "./mime";
export { render } from "./render";

/**
 * An email authored as a class: who it goes to, what it says, and what it looks
 * like. A class implementing it can be handed straight to `send()` or `later()`.
 *
 * Declared as an alias rather than re-exported, because the layout kit below
 * publishes the same name in value space and only an alias can share the identifier.
 */
export type Email = EmailContract;

/**
 * Layout kit for email bodies: `Email.Layout`, `Email.Heading`, `Email.Text`,
 * `Email.Button`, and `Email.Footer`. Named as a namespace because that is how the
 * components are addressed, and it shares the identifier with the `Email` contract.
 */
export const Email = EmailComponents;
