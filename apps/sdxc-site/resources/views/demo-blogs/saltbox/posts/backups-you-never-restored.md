---
title: A backup you have never restored is a rumour
description: I found out my nightly dumps were empty the week I needed one. What I check now, every month, and why the restore drill is the actual backup.
kind: articles
date: "2025-11-19"
tags: [backups, postgres, self-hosting]
---

For eleven months, a cron job on one of my servers ran `pg_dump` every night and uploaded the result. For the last three of those months, the file it uploaded was twenty bytes long. A changed password had broken the connection, the script did not check the exit status, and the upload step dutifully shipped the error message.

I found out when I needed a backup. Luckily it was a staging database.

## The restore is the backup

A dump file is a claim that you could rebuild the database. The only proof is rebuilding it. Once a month I now restore the latest dump into a throwaway Postgres, and run three checks against it:

1. The restore finishes without errors.
2. The row counts of the five largest tables are within a few percent of production.
3. The newest row in the busiest table is less than a day old.

The third check catches the failure I actually had: a backup that runs, uploads and restores perfectly, of data that stopped changing weeks ago.

## Make failures loud

The backup script now runs with `set -euo pipefail`, so any failing step stops it, and it pings a dead man's switch only after a successful upload. If the ping does not arrive by morning, I get an email. Silence is no longer success.

The full script is part three of the [self-hosting series](/showcase/saltbox/demo/tutorials/nightly-postgres-backups).
