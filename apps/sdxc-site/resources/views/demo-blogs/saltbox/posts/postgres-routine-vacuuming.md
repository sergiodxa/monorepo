---
title: "PostgreSQL docs: Routine Vacuuming"
description: The chapter that explains why dead rows exist, what autovacuum does about them, and how transaction ID wraparound can stop a database.
kind: links
date: "2026-09-23"
tags: [postgres]
url: https://www.postgresql.org/docs/current/routine-vacuuming.html
---

I send this to everyone who asks why their table is twice the size of its data. It explains, without hand-waving, how [MVCC](/showcase/saltbox/demo/glossary/mvcc) leaves old row versions behind and how vacuum reclaims them. The section on wraparound is the one to read twice: it is rare, but it is the one failure where Postgres refuses writes to protect you.
