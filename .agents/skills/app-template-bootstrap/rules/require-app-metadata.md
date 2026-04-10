---
title: Require App Name and Description
impact: HIGH
tags: [bootstrap, metadata, input]
---

# Require App Name and Description

Do not start bootstrapping a new app until you have both the new app name and the app description.

## Why

- **Consistency**: The same values must be applied across folder names, config, and docs
- **Clarity**: The README should describe the app immediately after creation
- **Fewer follow-up edits**: Asking once up front avoids partial placeholder replacement

## Pattern

```text
Required before copying:

- name: my-app
- description: Internal dashboard for team operations.

Bad:
- name only
- description left as <brief description of the app>
```

## Good

```text
User request: "Create a new app called team-ops."

Ask next:
"What description should I use for `team-ops` in `README.md`?"
```

## Bad

```text
Creating apps/team-ops/ with:

README.md
# <app-name>

<app-name> is a <brief description of the app>.
```

## Rules

1. Require both the app name and description before copying `templates/app`
2. If either value is missing, ask for it instead of guessing
3. Keep the provided description concise enough to fit the README opening line
