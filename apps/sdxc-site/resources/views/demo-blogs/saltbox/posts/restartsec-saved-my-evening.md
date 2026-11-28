---
title: RestartSec saved my evening
description: A crash loop that hammered the database, and the one-line fix.
kind: notes
date: "2025-12-10"
tags: [linux, self-hosting]
---

A bad config made a service exit at startup, and systemd restarted it as fast as it could until it hit the start limit and gave up. Each attempt opened a database connection first. Now every unit I write has `Restart=on-failure` with `RestartSec=2s`, and `StartLimitIntervalSec=60` with `StartLimitBurst=10` under `[Unit]`, so a broken deploy backs off politely and stays down long enough for me to read `journalctl` and notice.
