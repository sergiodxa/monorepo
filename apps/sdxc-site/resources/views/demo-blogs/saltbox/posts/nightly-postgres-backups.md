---
title: "Self-hosting a Go service: nightly Postgres backups"
description: Part three. Dump the database every night, ship it off the machine, and fail loudly the first time anything goes wrong.
kind: tutorials
date: "2026-09-02"
tags: [backups, postgres, self-hosting]
series: Self-hosting a Go service
part: 3
---

The service runs and serves HTTPS. Now the part that decides whether a dead disk is an inconvenience or a catastrophe.

## Step 1: Write the backup script

Use the custom format, which compresses and lets `pg_restore` pick individual tables later:

```sh {% title="/usr/local/bin/backup-notes" %}
#!/usr/bin/env bash
set -euo pipefail

stamp=$(date -u +%Y-%m-%dT%H%M)
file="/var/backups/notes-$stamp.dump"

pg_dump --format=custom --dbname=notes --file="$file"
test -s "$file"
rclone copy "$file" offsite:notes-backups/
curl -fsS --retry 3 "$HEARTBEAT_URL" > /dev/null
find /var/backups -name 'notes-*.dump' -mtime +7 -delete
```

`set -euo pipefail` stops the script at the first failure, and `test -s` refuses an empty file. The heartbeat only fires when every step before it succeeded.

> [!WARNING]
> A dump stored on the same disk as the database is a copy, not a backup. The `rclone copy` to another provider is the step that matters.

## Step 2: Run it nightly with a timer

```ini {% title="/etc/systemd/system/backup-notes.timer" %}
[Timer]
OnCalendar=*-*-* 03:15:00
RandomizedDelaySec=10m
Persistent=true

[Install]
WantedBy=timers.target
```

`Persistent=true` runs a missed backup at the next boot if the machine was off at 03:15.

## Step 3: Restore one, today

```sh {% title="Terminal" %}
createdb notes_restore
pg_restore --dbname=notes_restore --no-owner /var/backups/notes-latest.dump
psql notes_restore -c 'select max(created_at) from notes'
```

If the newest row is from last night, the series is complete. I wrote about [why the restore is the real backup](/showcase/saltbox/demo/articles/backups-you-never-restored) separately.
