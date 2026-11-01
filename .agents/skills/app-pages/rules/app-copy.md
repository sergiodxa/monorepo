---
title: Words Are Part of the Interface
impact: MEDIUM
tags: [copy, labels, microcopy, toasts, errors]
---

# Words Are Part of the Interface

In an app, copy is mostly labels, and labels are read hundreds of times. Short, consistent and specific
beats friendly.

- **Buttons are Verb + Noun** in sentence case: "Create monitor", "Pause monitor", not "Submit" or "OK".
- **"…" only when a dialog follows** ("Delete monitor…" opens a confirm; "Pause monitor" acts at once).
- **The toast verb matches the button verb**: "Pause monitor" → "Monitor paused".
- **Destructive last**, behind a divider in menus; danger tone only on the action itself.
- **Errors end with a next step**: "Couldn't verify domain. Check the TXT record and try again."
- **Name empty values**: "No reviewers", "Never checked", `—` in tables.
- **Numbers carry units and comparisons**: "182 ms", "+0.4% vs last week".
- **Times are relative and local** up to a week, absolute after; the absolute time is one hover away.
- **Status words are fixed**: pick Up / Degraded / Down / Paused once and use them everywhere, with the
  same tone (success / warning / danger / neutral).
- Every string a component shows is a prop the app translates; nothing English is baked into a part.

## Rules

1. Verb + Noun labels; past-tense toasts that echo them.
2. One status vocabulary per app, one tone per status.
3. Errors say what to do next.
