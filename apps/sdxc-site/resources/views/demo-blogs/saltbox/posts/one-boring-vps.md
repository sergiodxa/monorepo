---
title: The case for one boring server
description: Most of my side projects, and two small businesses, run on a single virtual machine with Postgres, Caddy and systemd. Here is what that buys, what it costs, and where I draw the line.
kind: articles
date: "2026-07-22"
tags: [self-hosting, linux, postgres]
---

Every few months someone asks me how to deploy a small Go app, and every few months I give the same unfashionable answer: rent one server, put everything on it, and write down how you did it.

## What one server buys you

One machine means one place to look. The logs are in `journalctl`, the database is on `localhost`, and the reverse proxy config is one file. When something breaks at night there is no question of which of nine managed services moved; there is one box, and you can SSH into it.

It is also cheap in a way that changes decisions. A machine with four cores and eight gigabytes costs less a month than a team lunch, and it will serve a few hundred requests a second from a Go binary without noticing.

## What it costs

The machine is a single point of failure, and pretending otherwise is how people lose data. So I pay for that honestly:

- Nightly database dumps, shipped off the machine and restored every month to prove they work.
- The whole setup written as a script and a handful of config files in the repository, so a replacement box is an hour away, not a weekend.
- An external uptime check, so I hear about an outage before a customer does.

## Where I draw the line

When downtime for a kernel upgrade becomes unacceptable, or one workload needs more than a machine can give, it is time for two. That day comes much later than most architecture diagrams assume. Until then, boring is a feature: it leaves the interesting problems for the product.

I wrote the whole setup down in the [self-hosting series](/showcase/saltbox/demo/tutorials/static-binary-and-systemd), from a static binary to backups in object storage.
