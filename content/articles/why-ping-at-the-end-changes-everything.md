---
title: Why "Ping at the End" Changes Everything
excerpt: The position of your health check ping determines what you're actually monitoring.
---

Most cron monitoring tutorials show you how to add a ping to your scheduled job. Few explain where that ping should go. This seemingly minor detail fundamentally changes what your monitoring actually measures. When implementing [the dead man's switch pattern](/articles/the-dead-man-s-switch-pattern), ping placement determines whether you're monitoring job starts or job completions.

## The Two Positions

Consider a backup job that runs nightly:

```bash
#!/bin/bash
curl https://monitor.example.com/ping/backup-job  # Ping at start
pg_dump mydb > /backups/nightly.sql
gzip /backups/nightly.sql
aws s3 cp /backups/nightly.sql.gz s3://backups/
```

vs

```bash
#!/bin/bash
pg_dump mydb > /backups/nightly.sql
gzip /backups/nightly.sql
aws s3 cp /backups/nightly.sql.gz s3://backups/
curl https://monitor.example.com/ping/backup-job  # Ping at end
```

The first script tells you the job started. The second tells you the job succeeded.

## What "Started" Actually Means

A ping at the start confirms:

- The scheduler triggered the job
- The execution environment is available
- Network connectivity exists (at least to the monitor)

It does not confirm:

- The job logic executed correctly
- External dependencies were available
- Data was processed successfully
- The job completed at all

If your backup job pings at the start, then crashes during the S3 upload, your monitor shows a successful run. Your backups are missing, but your dashboard is green.

## What "Completed" Actually Means

A ping at the end confirms everything the start ping confirms, plus:

- The job ran to completion without crashing
- All commands in the sequence executed
- The script reached its final line

This is dramatically more useful. A missing ping now means something actually failed, not just that the job didn't start.

## The Subtle Trap

Many monitoring guides show the ping first because it's the simplest example:

```bash
curl https://monitor.example.com/ping/my-job && ./run-job.sh
```

This pattern is easy to understand and demonstrate. It also monitors the wrong thing. The `&&` means the job only runs if the ping succeeds, but a successful ping says nothing about the job itself.

The correct pattern:

```bash
./run-job.sh && curl https://monitor.example.com/ping/my-job
```

Now the ping only fires if `run-job.sh` exits with status 0.

## Exit Codes Matter

Placing the ping at the end only works if your job uses exit codes correctly. A script that always exits 0, even on failure, will ping successfully regardless of what happened.

```bash
#!/bin/bash
set -e  # Exit on any error

pg_dump mydb > /backups/nightly.sql
gzip /backups/nightly.sql
aws s3 cp /backups/nightly.sql.gz s3://backups/

# Only reached if all commands succeeded
curl https://monitor.example.com/ping/backup-job
```

The `set -e` directive ensures the script stops on the first error. The ping at the end becomes a reliable success signal.

## Both Positions Have Value

Some monitoring services support both start and end pings:

```bash
#!/bin/bash
set -e

curl https://monitor.example.com/ping/backup-job/start
pg_dump mydb > /backups/nightly.sql
gzip /backups/nightly.sql
aws s3 cp /backups/nightly.sql.gz s3://backups/
curl https://monitor.example.com/ping/backup-job/end
```

This gives you:

- **Start without end**: Job crashed mid-execution
- **End without start**: Impossible (indicates a bug in your script)
- **Neither**: Job never started (scheduler issue, environment unavailable)
- **Both**: Job completed successfully

The duration between start and end also becomes a useful metric. A backup that usually takes 5 minutes but suddenly takes 45 minutes is worth investigating, even if it eventually succeeds. This is where [grace periods](/articles/designing-grace-periods-for-variance) become essential for handling the natural variance in execution times without triggering false alerts.

## Error Reporting

Advanced monitoring services let you report failures explicitly:

```bash
#!/bin/bash

curl https://monitor.example.com/ping/backup-job/start

if pg_dump mydb > /backups/nightly.sql && \
   gzip /backups/nightly.sql && \
   aws s3 cp /backups/nightly.sql.gz s3://backups/; then
  curl https://monitor.example.com/ping/backup-job/success
else
  curl https://monitor.example.com/ping/backup-job/fail
fi
```

Now you distinguish between "job failed" and "job never ran" in your monitoring dashboard.

## The Default Should Be End

If you can only ping once, ping at the end. This is the more useful signal in almost every case.

The exception is jobs where starting is the hard part. A job that requires acquiring a distributed lock, connecting to a flaky external service, or bootstrapping a complex environment might benefit from a start ping. But even then, you probably want both.

When reviewing cron monitoring setups, check where the ping lives. A ping at the start is a common mistake that creates false confidence in systems that might be silently failing.
