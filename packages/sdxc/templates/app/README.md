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
bunx sdxc make controller about
bunx sdxc make job reports/daily --cron "0 8 * * *"
bunx sdxc make mcp search-posts
```

A controller, a job and an MCP tool or resource are also declared and mapped, so they answer
as soon as the command finishes.

## Check and deploy

```sh
bun check
bun test
bun build
bun cf:deploy
```

Create the job queue once before the first deploy: `bunx cf queues create <name>`, using the
`name` in `package.json`.
