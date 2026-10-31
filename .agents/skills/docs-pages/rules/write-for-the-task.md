---
title: Write for the Task
impact: HIGH
tags: [copy, writing, titles, examples, product-docs]
---

# Write for the Task

The reader of a docs page is in the middle of something. Every sentence either moves them forward or
makes them wait. Good docs copy is specific, imperative and short, and it answers the question in the
first lines instead of building up to it.

## Why

- **Readers skim the first sentence of each section and the code.** If the answer isn't there, they
  scroll past it.
- **Vague docs cost support tickets.** "Configure your settings as needed" is the sentence that becomes
  an email.

## Titles

- **Guides are tasks, in the reader's words**: "Check that sign-in works every 15 minutes", "Add a
  custom domain". Not "Flow monitors overview" or "Domain management".
- **References are the name**: `createCookie(name, options)`, "Alert channels".
- **Sentence case** everywhere, no Title Case.
- **The description under the title says the outcome**: "Run a scripted browser through your login and
  get alerted when a step fails." Not "This page describes flow monitors."

## Sentences

```text
Weak:   In order to get started, you'll first want to make sure you have installed the CLI.
Strong: Install the CLI:
```

- Imperative for steps ("Run", "Open", "Click **Save**"), present tense for behaviour ("The check runs
  every minute").
- One idea per paragraph, three sentences at most; a fourth means a list or a new section.
- Name UI exactly as it appears, in bold, with the path as `Settings › Team › Members` (Linear, Notion).
- Keyboard shortcuts as keys: <kbd>⌘</kbd> <kbd>K</kbd>.
- State defaults and limits as figures from the code, never "a reasonable default".

## Examples

- **Every concept gets an example the reader can copy**, with real-looking values (`api.example.com`,
  `uptime_live_…`), never `foo`/`bar`.
- **Show the result**: the output of the command, the response body, the screenshot of the screen after
  the step. A step without a visible result leaves the reader unsure it worked.
- **One world per page**: the same project name, host and user through every example, so a reader can
  follow a thread (the docs version of a landing's shared sample data).

## Product docs (for non-developers)

- No code unless the task needs it. Screenshots of the real UI instead, cropped to the part that matters.
- Say who can do it and on which plan, at the top: "Admins on the Team plan".
- Troubleshooting pages are titled by the symptom: "My check says Down but my site is up".
- End with what to do if it still doesn't work (support link, status page).

## Rules

1. Title guides as tasks, references by name, sentence case.
2. Put the answer in the first sentence of each section.
3. Give every concept a copyable example with believable values, and show its result.
4. In product docs, show the screen, name the UI path, and state plan and role up front.
