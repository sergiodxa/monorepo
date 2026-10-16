/**
 * The spam filter a form's action scores submissions with, through `spam(spamFilter, …)` from
 * `@sdxc/spam/middleware`: the local rules weigh links, markup and how fast the form came back,
 * with no account or network call. Add reputation checks here as the app's forms attract them.
 */

import { createSpamFilter, DEFAULT_RULES } from "@sdxc/spam";

/** Scores a submission as `ham`, `unsure` or `spam`, with every signal that fired. */
export const spamFilter = createSpamFilter({ checks: DEFAULT_RULES });
