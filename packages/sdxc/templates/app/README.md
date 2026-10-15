# App

A Remix v3 Worker on Cloudflare, built on [`sdxc`](https://www.npmjs.com/package/sdxc).

## Develop

```sh
bun install
bun cf:typegen
bun dev
```

`bun cf:typegen` writes the Worker's types from `cloudflare.config.ts`; run it again after
changing a binding.

## Add code

`sdxc make <kind> <name>` writes a file of that kind where it belongs, with a test beside it:

```sh
sdxc make controller about
sdxc make job reports/daily --cron "0 8 * * *"
sdxc make mcp search-posts
```

A controller, a job and an MCP tool or resource are also declared and mapped, so they answer
as soon as the command finishes.

## Run commands

`bootstrap/cli.ts` is the app's own command line, for work that belongs to the app but to no
request. It runs on Bun, outside the Worker, through its package script:

```sh
bun run cli about
bun run cli --help
```

With `sdxc` installed globally (`npm add -g sdxc`), `sdxc run about` does the same from any
folder in the project.

`app/commands/index.ts` declares each command, and `sdxc make command users/grant` writes a
new one with its test, declared and mapped.

## Check and deploy

```sh
bun check
bun test
bun build
bun cf:deploy
```

Create the job queue once before the first deploy: `bunx cf queues create <name>`, using the
`name` in `package.json`.
