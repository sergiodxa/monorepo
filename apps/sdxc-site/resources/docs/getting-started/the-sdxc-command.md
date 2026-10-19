---
title: The sdxc command
description: The command line that starts a project, generates files where the layout puts them, copies UI components, upgrades, checks and deploys, and where each of those is covered.
section:
    title: Getting started
    order: 1
order: 4
lastUpdated: 2026-10-19
outcomes:
    - "How to install the `sdxc` command"
    - "Which command does what, and which guide covers it"
    - "How every command answers a question up front with a flag"
---

The `sdxc` command writes a new project, adds controllers, jobs, models and the rest where the
app layout puts them, copies `@sdxc/ui` components into your project when you want to edit one,
and moves the project to a newer release with a prompt that tells an AI agent what changed for
the code you have.

It ships in [`@sdxc/kit`](/api/kit). Install it globally so you can type the commands as
written; your app imports each package it uses by its own name, such as `@sdxc/result`:

```bash
npm add -g @sdxc/kit
```

Every command runs from the project root, the nearest folder with a `package.json`, and
`sdxc <command> --help` lists its arguments and flags. On a terminal a command asks for what
you left out, and every question has a flag, so a script or an agent passes the answer up front
and never waits on one.

## What it does

Each command has a guide of its own:

- [Start a project](/docs/sdxc/start-a-project) — `sdxc create` from the built-in template or
  any GitHub repository, and `sdxc init` for the configuration file.
- [Generate files](/docs/sdxc/generate-files) — `sdxc make` writes a controller, job, model,
  migration or any other kind of file where the layout puts it, declared, mapped and tested.
- [Scaffold a resource](/docs/sdxc/scaffold-a-resource) — `sdxc scaffold` writes a model, its
  migration and the pages to list, read, create, change and delete it.
- [Copy UI components](/docs/sdxc/copy-ui-components) — `sdxc ui` copies an `@sdxc/ui`
  component to edit and keeps the copy current.
- [Upgrade](/docs/sdxc/upgrade) — `sdxc upgrade` moves to a newer release and prints a prompt
  for your agent.
- [Check a project](/docs/sdxc/check-a-project) — `sdxc doctor` finds pins, installs and
  secrets that disagree, migrations a new database cannot replay, and layout and wiring
  mistakes.
- [List routes](/docs/sdxc/list-routes) — `sdxc routes` prints every route with its controller
  and middleware.
- [Run your app's commands](/docs/sdxc/run-app-commands) — `sdxc run` runs the command line
  your app ships.
- [Deploy](/docs/sdxc/deploy) — `sdxc deploy` builds, migrates and deploys in that order.

## Where to go next

- [Build a command line](/docs/operations-and-testing/build-a-command-line) — `@sdxc/cli`, the
  package this command line is built on.
- [`@sdxc/kit`](/api/kit) — every command and configuration key.
