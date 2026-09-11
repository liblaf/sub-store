<div align="center" markdown>

![sub-store](https://socialify.git.ci/liblaf/sub-store/image?description=1&forks=1&issues=1&language=1&name=1&owner=1&pattern=Transparent&pulls=1&stargazers=1&theme=Auto)

[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun)](https://bun.sh)
[![Built with Cloudflare](https://workers.cloudflare.com/built-with-cloudflare.svg)](https://www.cloudflare.com/developer-platform/products/workers/)

[Changelog](https://github.com/liblaf/sub-store/blob/main/CHANGELOG.md) · [Report a bug](https://github.com/liblaf/sub-store/issues) · [Request a feature](https://github.com/liblaf/sub-store/issues)

![Rule](https://cdn.jsdelivr.net/gh/andreasbm/readme/assets/lines/rainbow.png)

</div>

`sub-store` builds validated Mihomo and Stash configurations from subscription providers, then publishes prebuilt artifacts through a Cloudflare Worker and KV.

## ✨ Features

- Renders YAML templates with [JSON-e](https://json-e.js.org/), removes private `__*` fields and empty proxy groups, and rejects unresolved references.
- Validates rendered references for both formats and additionally checks Mihomo output with `mihomo -t` before writing an artifact.
- Caches upstream responses in `~/.cache/sub-store/` for one hour and stops the build if a refresh fails or returns invalid data.
- Exposes generated quota, expiry, and update entries separately as `infoProxies`; templates place them in `Info` while keeping upstream informational nodes in `Unknown`.
- Publishes `/subs/<ID>/mihomo.yaml` and `/subs/<ID>/stash.yaml` with the generated `Subscription-Userinfo` response header.

## 📦 Provider file

Provider input is strict: each provider must define exactly one of `mihomo` or `mixed`. The optional root `vars` object permits only `TS_AUTH_KEY`; `bwcounter` and proxy-name overrides are optional.

```yaml
id: 0123456789ABCDEFGHJK
vars:
  TS_AUTH_KEY: <redacted>
providers:
  - name: Example
    mihomo: https://example.com/subscription.yaml
    bwcounter: https://example.com/bwcounter.json
    override:
      proxy-name:
        - pattern: ^Old Name$
          target: New Name
  - name: Mixed Example
    mixed: https://example.com/subscription
```

Use a 20-character uppercase Crockford Base32 token for new profile IDs. Existing UUID profile IDs remain supported.

See the redacted, ready-to-copy example at [providers.example.yaml](https://github.com/liblaf/sub-store/blob/main/providers.example.yaml).

## ⌨️ Build

Install dependencies and ensure `mihomo` is available on `PATH`:

```bash
bun install
```

Build either format from a repository checkout:

```bash
bun run ./cli/bin/sub-store.ts build mihomo \
  --template templates/mihomo.yaml \
  --providers providers.yaml \
  --output artifacts/mihomo.yaml

bun run ./cli/bin/sub-store.ts build stash \
  --template templates/stash.yaml \
  --providers providers.yaml \
  --output artifacts/stash.yaml
```

The published package exposes the same commands through the `sub-store` executable.

Each build writes the YAML artifact and a sibling `.metadata.json` file with owner-only permissions. The metadata file contains response headers. Missing provider usage fields do not create corresponding information nodes. The published aggregate header only contains a field when every header-based provider supplies it; bwcounter data is display-only and is never converted into `Subscription-Userinfo`.

Custom templates receive a versioned JSON-only context. In version 7, `proxies` contains normalized provider proxy records, `infoProxies` contains generated display-only proxy records, and each `countries[].proxies` entry contains the corresponding provider proxy records. Templates should map each record's `name` when constructing proxy groups and append `infoProxies` to the final client proxy list. The `vars` object contains only the strict profile variables explicitly exposed by the builder; Stash exposes `TS_AUTH_KEY`.

The Stash template requires `vars.TS_AUTH_KEY` and embeds it in the generated configuration. It does not read a host environment variable. Treat provider profiles, cached provider responses, and every generated artifact as secrets. Automatic Tailnet routing is disabled so the template's explicit rule sets remain authoritative.

## ☁️ Publish to Cloudflare

The CLI builds profiles locally and uploads the finished artifacts to the Worker:

```bash
export SUB_STORE_API_TOKEN='<upload token>'
sub-store publish                                  # ~/.config/sub-store/profiles/*.yaml
sub-store publish /path/to/profiles                 # another folder
sub-store publish /path/to/profile.yaml             # one profile
```

It uses the built-in Mihomo and Stash templates and requires `mihomo` on `PATH`. Every profile
must include `vars.TS_AUTH_KEY` for Stash. All profiles are parsed and both formats are built
before any upload begins. Empty folders, duplicate profile IDs, build failures, and upload
failures cause a nonzero exit. Folder discovery is nonrecursive and matches non-hidden `*.yaml`
files.

`SUB_STORE_URL` selects the Worker address and defaults to `https://subs.liblaf.me`. HTTPS is
required except for localhost development. The CLI sends `SUB_STORE_API_TOKEN` in the
`Authorization: Bearer` header and refuses redirects.

Configure the same upload token as a Worker secret before using the API:

```bash
wrangler secret put SUB_STORE_API_TOKEN
wrangler deploy
```

Deploy the updated Worker to enable `PUT /api/profiles/:id/artifacts`. Its JSON body contains
`mihomo` and `stash`, each with a `body` YAML string and `metadata.headers`. Only the optional
`Subscription-Userinfo` metadata header is accepted, and the complete request is limited to
10 MiB. The Worker authenticates and validates the request before writing the existing
`artifacts/<ID>/mihomo.yaml` and `artifacts/<ID>/stash.yaml` KV keys. It returns `204` after both
writes succeed. The upload token grants publishing access to all profiles and is separate from
the bearer IDs used for downloads.

KV writes are not transactional: an upload failure can leave some artifacts updated, and
updates may take time to reach every location. The CLI stops on the first failed upload.

The repository uses the `KV` binding in `wrangler.toml`. Configure the desired custom domain
in Cloudflare. Subscriptions are available at `/subs/<ID>/mihomo.yaml` and
`/subs/<ID>/stash.yaml`. Each successful response starts with a `#SUBSCRIBED <canonical URL>`
marker. The ID is a bearer credential; keep subscription URLs private.

The CLI publishes locally managed profiles. It replaces the repository's former shell tasks
for syncing profiles through KV and publishing artifacts. Worker deployment is a separate
`wrangler deploy` operation. Scheduling, systemd units, and local Mihomo installation and
restarts are managed by the dotfiles repository.
