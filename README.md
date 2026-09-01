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
- Caches upstream responses in `~/.cache/sub-store/` for one hour and uses a validated stale response with a warning when an upstream provider is unavailable.
- Exposes generated quota, expiry, and update entries separately as `infoProxies`; templates place them in `Info` while keeping upstream informational nodes in `Unknown`.
- Publishes `/subs/<ID>/mihomo.yaml` and `/subs/<ID>/stash.yaml` with the generated `Subscription-Userinfo` response header.

## 📦 Provider file

Provider input is strict: each provider must define exactly one of `mihomo` or `mixed`. `bwcounter` and proxy-name overrides are optional.

```yaml
id: 0123456789ABCDEFGHJK
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

Each build writes the YAML artifact and a sibling `.metadata.json` file containing response headers. Missing provider usage fields do not create corresponding information nodes. The published aggregate header only contains a field when every header-based provider supplies it; bwcounter data is display-only and is never converted into `Subscription-Userinfo`.

Custom templates receive a versioned JSON-only context. In version 6, `proxies` contains normalized provider proxy records, `infoProxies` contains generated display-only proxy records, and each `countries[].proxies` entry contains the corresponding provider proxy records. Templates should map each record's `name` when constructing proxy groups and append `infoProxies` to the final client proxy list.

## ☁️ Publish to Cloudflare

The repository uses the `KV` binding in `wrangler.toml`. Put provider files under `tmp/profiles/`, upload them once, then publish:

```bash
REMOTE=true mise run put-profiles
mise run publish
```

`publish` reads the remote profiles, validates and uploads both artifacts, and deploys the Worker only after the KV writes succeed. Configure the desired custom domain in Cloudflare, then subscriptions are available at:

```text
https://subs.example.com/subs/<ID>/mihomo.yaml
https://subs.example.com/subs/<ID>/stash.yaml
```

The ID is a bearer credential. Keep subscription URLs private.

Each successful response starts with `#SUBSCRIBED <canonical URL>`. The Mihomo pull script uses
this marker as the update source on later runs; its `--id` option is only the bootstrap fallback
for an absent or unmarked installed configuration.
