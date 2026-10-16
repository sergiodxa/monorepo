/**
 * The board's mailer, sending through a transport that keeps every message in memory. The
 * app runs on a laptop with no inbox behind it, so the captured messages are the delivery:
 * `/outbox` reads {@link outbox} and shows what a recipient would have received.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Mailer } from "@sdxc/mail";
import { MemoryTransport } from "@sdxc/mail/memory";

import { MAIL_FROM } from "~/config/constants";

/** Every message the board has sent, oldest first, for the whole life of the worker. */
export const outbox = new MemoryTransport();

/** The mailer every send goes through, addressed from the board itself. */
export const mailer = new Mailer({ transport: outbox, from: MAIL_FROM });
