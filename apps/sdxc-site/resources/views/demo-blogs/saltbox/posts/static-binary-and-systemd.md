---
title: "Self-hosting a Go service: a static binary under systemd"
description: Part one. Build one file that runs anywhere, give it its own user, and let systemd start it, restart it and collect its logs.
kind: tutorials
date: "2026-08-05"
tags: [go, self-hosting, linux]
series: Self-hosting a Go service
part: 1
---

This series takes a small Go web service from a laptop to a public server you control, with TLS and backups. Part one gets the binary running as a proper service.

## Step 1: Build a static binary

Disable cgo so the binary links nothing from the build machine, and strip the debug tables to keep it small:

```sh {% title="Terminal" %}
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o bin/notes ./cmd/notes
```

The result runs on any Linux machine of that architecture, with no runtime to install. Copy it to `/usr/local/bin/notes` on the server.

## Step 2: Give it a user of its own

The service should not run as root, and it should not share a user with anything else:

```sh {% title="Terminal" %}
sudo useradd --system --no-create-home --shell /usr/sbin/nologin notes
```

## Step 3: Write the unit

```ini {% title="/etc/systemd/system/notes.service" %}
[Unit]
Description=Notes web service
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
User=notes
EnvironmentFile=/etc/notes/env
ExecStart=/usr/local/bin/notes
Restart=on-failure
RestartSec=2s
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

> [!TIP]
> `ProtectSystem=strict` makes the whole file system read-only for the service. If it needs to write somewhere, grant exactly that directory with `StateDirectory=notes`.

## Step 4: Start it and read its logs

```sh {% title="Terminal" %}
sudo systemctl daemon-reload
sudo systemctl enable --now notes
journalctl -u notes -f
```

The service now starts at boot and comes back two seconds after a crash. In [part two](/showcase/saltbox/demo/tutorials/caddy-in-front) we put Caddy in front of it for HTTPS.
