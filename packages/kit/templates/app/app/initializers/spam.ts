/**
 * The spam filter a form scores what a visitor wrote with: the local rules, which weigh links,
 * markup and how fast the form came back, and need no account or network call. Add reputation
 * checks from `@sdxc/spam` here as the app's forms attract them.
 */

import { createSpamFilter, DEFAULT_RULES } from "@sdxc/spam";

/** Scores a submission as `ham`, `unsure` or `spam`, with every signal that fired. */
export const spamFilter = createSpamFilter({ checks: DEFAULT_RULES });
