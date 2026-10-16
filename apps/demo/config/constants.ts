/**
 * Values the board is configured with that never change between requests, stated once so the
 * code that publishes them and the code that tests them agree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Who the board's email comes from, as the confirmation and the outbox show it. */
export const MAIL_FROM = { email: "jobs@demo.test", name: "Remix Job Board" };
