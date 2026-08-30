# Storefront Preview deployment

## Scope

This runbook deploys a reviewed Storefront commit to
<https://test.luxe-pack.biz>. It does not change `luxe-pack.biz`, V1,
`admin.luxe-pack.biz`, `ad.luxe-pack.biz`, the Platform Repository, or the
Platform upstream.

The Preview virtual host keeps these boundaries in order:

1. `/api/v2` and `/api/v2/` continue to use the MIG-061Z Platform proxy.
2. `/admin/api/` continues to return the local 404 Problem response.
3. Only the remaining `/` location proxies to the Next.js Preview process.

Do not add CORS or expose the Next.js listen port externally.

## Runtime layout

| Item | Value |
| --- | --- |
| Service | `luxe-pack-storefront-preview.service` |
| Runtime user/group | `luxe-pack-storefront-preview` |
| Listen address | `127.0.0.1:3200` |
| Release root | `/var/lib/luxe-pack-storefront-preview/releases` |
| Active release | `/var/lib/luxe-pack-storefront-preview/current` |
| Environment file | `/etc/luxe-pack-storefront-preview/preview.env` |
| Nginx virtual host | `/etc/nginx/conf.d/test.luxe-pack.biz.conf` |
| Backup root | `/var/backups/luxe-pack-storefront-preview` |

The environment file is root-owned mode `0600`. It contains only the public
runtime contract below; add no credentials, Cookie values, or tokens.

```dotenv
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://test.luxe-pack.biz
NEXT_PUBLIC_PLATFORM_API_BASE_URL=/api/v2
```

`NEXT_PUBLIC_*` values must also be present while running `pnpm build`, because
Next.js embeds them in the browser bundle. The relative Platform base URL keeps
Browser traffic on the same Preview Origin.

## Release preparation

Use the Build Authority in `docs/engineering-governance.md`. This filesystem
release flow can readily build the Squash-Merged `main` commit and should use
that preferred authority. Create the release from `git archive <squash-sha>` so
local reports and other untracked files are never copied. The source commit must
have all five GitHub gates and its required fresh self-review complete. The
release directory is owned by the runtime user. Use Node `22.22.3`, pnpm
`10.12.1`, `pnpm install --frozen-lockfile`, and a production `pnpm build`;
never run the development server as a service.

If another pipeline needs to reuse a build produced from the Final PR Head, it
must satisfy the documented Reviewed Tree Authority after Squash Merge: identical
Final Head and Merge tree SHAs, content diff `0`, matching build provenance, and
complete Required Check and fresh self-review evidence. Any mismatch fails
closed and prohibits Activation of that build.

Before switching `current`, verify:

```text
pnpm artifact:check
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Keep the previous `current` target until post-deployment smoke passes. The active
symlink must identify the exact Squash Commit directory.

## systemd unit

The Preview-only unit uses the active release and listens on localhost:

```ini
[Unit]
Description=Luxe Pack Storefront Preview
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=luxe-pack-storefront-preview
Group=luxe-pack-storefront-preview
WorkingDirectory=/var/lib/luxe-pack-storefront-preview/current
EnvironmentFile=/etc/luxe-pack-storefront-preview/preview.env
ExecStart=/usr/bin/pnpm exec next start --hostname 127.0.0.1 --port 3200
Restart=on-failure
RestartSec=5s
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/var/lib/luxe-pack-storefront-preview

[Install]
WantedBy=multi-user.target
```

After installing or changing the unit, run `systemctl daemon-reload`, enable the
Preview unit for boot, start it, verify it is active, restart it once, and inspect
only service metadata and sanitized application output. Do not print request
Cookie, token, or PII values.

## Nginx change

Retain the existing TLS directives and both Platform/API locations byte-for-byte.
Replace only the old `location /` 404 block with:

```nginx
location / {
    proxy_pass http://127.0.0.1:3200;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

No CORS directive is needed. Run `nginx -t` before reloading. A failed validation
must leave the running configuration untouched.

## Backup and rollback

Before changing Nginx or systemd, create one UTC timestamp directory under the
backup root and preserve file metadata for:

- the complete `test.luxe-pack.biz` virtual host;
- the Preview unit if it already exists;
- the previous active-release symlink target, if any.

To roll back the first deployment:

1. Restore the timestamped Nginx virtual-host backup.
2. Run `nginx -t`, then reload Nginx.
3. Stop and disable `luxe-pack-storefront-preview.service`.
4. Remove the Preview unit only after it is stopped, then run
   `systemctl daemon-reload`.
5. Leave `/api/v2`, `/api/v2/`, TLS, and `/admin/api/` exactly as restored from
   the backup.

For a later application-only rollback, repoint `current` to the previously
verified release and restart the Preview service; no Nginx change is required.

## Application-only release refresh

A refresh reuses the installed Nginx virtual host, Preview systemd unit,
localhost port, runtime user, and public environment file. Do not edit or reload
Nginx for an application-only refresh.

1. Record the current symlink target, service state, filesystem capacity, and
   the Nginx configuration checksum.
2. Create a new immutable directory named for the approved application commit
   from `git archive <commit>`; never copy an untracked local report.
3. Verify Artifact integrity, perform the frozen install and production build
   with the Preview public environment, and confirm the required UI source is
   present before switching.
4. Atomically repoint `current` to the verified release and restart only
   `luxe-pack-storefront-preview.service`.
5. Run the non-mutating HTTPS/API/Admin-boundary smoke checks and verify that the
   Nginx checksum, TLS/API boundaries, and production Storefront remain
   unchanged.
6. If restart or smoke fails, atomically repoint `current` to the recorded
   previously verified release and restart the Preview service. Do not modify
   Nginx during this rollback.

Retain the previous verified release until the refresh smoke has passed. Never
remove unrelated releases or other service data to obtain capacity.

Record the active source revision, Build ID, deployable image/Artifact digest and
OCI source revision where applicable, plus the active deployment revision after
the switch. Production Activation is a separate Human checkpoint and is not
authorized by this Preview runbook.

## Verification

Run `pnpm preview:smoke` after the HTTPS switch. It checks the public and member
shell routes, the existing Terms route, both required Public API reads, the
Admin API 404 boundary, HTTP-to-HTTPS redirect, and the production Storefront
root. It logs only status and media type, never response bodies or headers.

Do not create synthetic Gacha, authenticate a real user, Draw, ship a Prize, or
exchange Points as part of this smoke. If no Browser runner is installed, record
the responsive Browser smoke as not performed and hand it to visual review.
