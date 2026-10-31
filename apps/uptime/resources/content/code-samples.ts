/**
 * Code the marketing pages show in their code stages: the REST and MCP calls, the cron
 * ping and a pasted zone file, each matching the documented public contract, so a visitor
 * can copy one and it works.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Creating a monitor over the REST API, as the HTTP monitors reference documents it. The
 * host and fields are the public contract, so they stay literal.
 */
export const CREATE_MONITOR_SH = `curl https://uptime.sergiodxa.com/api/v1/monitors \\
  -H "Authorization: Bearer uptime_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Production API",
    "url": "https://api.example.com/health",
    "method": "GET",
    "expectedStatus": 200,
    "intervalSeconds": 60
  }'`;

/**
 * The mcp-bridge config an agent's client loads, identical to the one `/mcp` hands a
 * signed-in visitor: the endpoint and header are what a client copies verbatim.
 */
export const MCP_JSON = `{
  "command": "npx",
  "args": [
    "-y",
    "@sdxc/mcp@latest",
    "https://uptime.sergiodxa.com/mcp",
    "--header",
    "Authorization:Bearer \${UPTIME_MCP_TOKEN}"
  ]
}`;

/** A nightly job that pings its cron monitor only when the backup succeeds. */
export const CRONTAB = `# Nightly backup, pinging Uptime only on success
UPTIME_API_KEY=uptime_your_api_key

0 2 * * * /srv/backup.sh && curl -fsS -X POST \\
  https://uptime.sergiodxa.com/api/v1/cron-jobs/{monitor-id}/ping \\
  -H "Authorization: Bearer $UPTIME_API_KEY"`;

/** The same ping from the end of a shell script, for a job that is not run by cron. */
export const BACKUP_SH = `#!/bin/bash
set -e

pg_dump mydb | gzip > backup.sql.gz

curl -fsS -X POST \\
  https://uptime.sergiodxa.com/api/v1/cron-jobs/{monitor-id}/ping \\
  -H "Authorization: Bearer $UPTIME_API_KEY"`;

/**
 * A zone file as a DNS monitor reads it: every name it declares becomes a tracked name, on
 * the documentation-reserved domain and addresses.
 */
export const ZONE_FILE = `$ORIGIN example.com.
$TTL 3600

@         IN  A      192.0.2.1
@         IN  AAAA   2001:db8::1
@         IN  MX     10 mail.example.com.
@         IN  TXT    "v=spf1 include:_spf.example.com ~all"
@         IN  CAA    0 issue "letsencrypt.org"
www       IN  CNAME  example.com.
api       IN  A      192.0.2.10
_dmarc    IN  TXT    "v=DMARC1; p=quarantine"`;
