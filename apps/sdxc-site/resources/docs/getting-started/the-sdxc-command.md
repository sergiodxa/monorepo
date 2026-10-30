---
title: The sdxc command
description: The command line that starts a project, generates files where the layout puts them, copies UI components, upgrades, checks and deploys, and where each of those is covered.
section:
    title: Getting started
    order: 1
order: 2
lastUpdated: 2026-10-25
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
written:

```bash
npm add -g @sdxc/kit
```

> [!NOTE]
> A project made with `sdxc create` lists `@sdxc/kit` in its own `devDependencies`, so CI and a
> fresh clone run `bunx sdxc …` at the project's release without a global install.

Every command runs from the project root, the nearest folder with a `package.json`, and
`sdxc <command> --help` lists its arguments and flags. On a terminal a command asks for what
you left out, and every question has a flag, so a script or an agent passes the answer up front
and never waits on one.

## Command map

| Command             | What it does                                                            | Guide                                                  |
| ------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------ |
| `sdxc create`       | write a new project from the built-in template or a GitHub repo         | [Start a project](/docs/sdxc/start-a-project)          |
| `sdxc init`         | write `.config/sdxc.jsonc` with every default spelled out               | [Start a project](/docs/sdxc/start-a-project)          |
| `sdxc make`         | write a controller, job, model or other file, declared and mapped       | [Generate files](/docs/sdxc/generate-files)            |
| `sdxc scaffold`     | write a resource's model, migration, pages or JSON endpoints, and tests | [Scaffold a resource](/docs/sdxc/scaffold-a-resource)  |
| `sdxc destroy`      | remove what `sdxc make` wrote, its mapping and its declaration          | [Undo a make](/docs/sdxc/undo-generated-files)         |
| `sdxc routes`       | print every route with its controller and middleware                    | [List routes](/docs/sdxc/list-routes)                  |
| `sdxc models`       | print each model's table and whether its migrations match               | [Inspect a project](/docs/sdxc/inspect-a-project)      |
| `sdxc schedule`     | list scheduled jobs, their next runs and the triggers that fire them    | [Inspect a project](/docs/sdxc/inspect-a-project)      |
| `sdxc middleware`   | print every middleware chain in run order                               | [Inspect a project](/docs/sdxc/inspect-a-project)      |
| `sdxc initializers` | list the initializers and what builds each one                          | [Inspect a project](/docs/sdxc/inspect-a-project)      |
| `sdxc notes`        | list the `TODO`, `FIXME`, `HACK` and `OPTIMIZE` comments in the code    | [Inspect a project](/docs/sdxc/inspect-a-project)      |
| `sdxc stats`        | count lines of code per kind, and the code to test ratio                | [Inspect a project](/docs/sdxc/inspect-a-project)      |
| `sdxc run`          | run your app's own command line: migrations, the SQL console, yours     | [Run your app's commands](/docs/sdxc/run-app-commands) |
| `sdxc doctor`       | find release drift, missing secrets and wiring mistakes                 | [Check a project](/docs/sdxc/check-a-project)          |
| `sdxc ui`           | copy an `@sdxc/ui` component into the project to edit it                | [Copy UI components](/docs/sdxc/copy-ui-components)    |
| `sdxc upgrade`      | move to a newer release and print a prompt for your agent               | [Upgrade](/docs/sdxc/upgrade)                          |
| `sdxc deploy`       | build, migrate production and deploy, in that order                     | [Deploy](/docs/sdxc/deploy)                            |

## Where to go next

- [Start a project](/docs/sdxc/start-a-project) — `sdxc create`, what a new project holds, and
  the configuration file.
- [Build a command line](/docs/operations-and-testing/build-a-command-line) — `@sdxc/cli`, the
  package this command line is built on.
- [`@sdxc/kit`](/api/kit) — every command and configuration key.
