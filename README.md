<div align="center" markdown>

![sub-store](https://socialify.git.ci/liblaf/sub-store/image?description=1&forks=1&issues=1&language=1&name=1&owner=1&pattern=Transparent&pulls=1&stargazers=1&theme=Auto)

[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun)](https://bun.sh)
[![Built with Cloudflare](https://workers.cloudflare.com/built-with-cloudflare.svg)](https://www.cloudflare.com/developer-platform/products/workers/)

[Changelog](https://github.com/liblaf/sub-store/blob/main/CHANGELOG.md) · [Report a bug](https://github.com/liblaf/sub-store/issues) · [Request a feature](https://github.com/liblaf/sub-store/issues)

![Rule](https://cdn.jsdelivr.net/gh/andreasbm/readme/assets/lines/rainbow.png)

</div>

`sub-store` compiles native Mihomo, Mihomo Smart, and Stash YAML profiles into static subscriptions and optionally publishes them through a Cloudflare Worker and KV.

## ✨ Features

- Keep client settings, static proxies, groups, rule providers, and routing rules in one native YAML profile.
- Fetch providers during the build and expand provider references into static proxy lists.
- Apply explicit name overrides and regex filters, with generated quota, expiry, reset, and update entries available through `$info`.
- Validate references for every target and run `mihomo -t` or `mihomo-smart -t` for the corresponding Mihomo output.
- Cache upstream responses for one hour. Failed fetches can reuse a valid stale cache with its original update date; invalid refresh data and failures without a valid cache fail the build.

## 📦 Native profiles

Start with [profile.example.yaml](https://github.com/liblaf/sub-store/blob/main/profile.example.yaml). Use separate native YAML files for Mihomo, Mihomo Smart, and Stash, with each client's own settings and proxy definitions. A profile looks like this:

```yaml
__sub-store:
  id: 0123456789ABCDEFGHJK
  target: stash

proxies:
  - name: Local Direct
    type: direct

proxy-providers:
  Example:
    url: https://example.invalid/subscription.yaml
    override:
      additional-prefix: "[Example] "
      proxy-name:
        - pattern: "(?i)^node (?<number>[0-9]+)$"
          target: "Node $<number>"

proxy-groups:
  - name: PROXY
    type: select
    proxies: [Local Direct]
    use: [Auto, Selected]
  - name: Auto
    type: url-test
    include-all-providers: true
    exclude-filter: "Traffic|剩余流量"
    benchmark-url: https://cp.cloudflare.com/generate_204
    interval: 300
  - name: Selected
    type: select
    use: [Example]
    filter: "Node [12]$"
  - name: Info
    type: select
    use: [$info]

rules:
  - MATCH,PROXY
```

Provider entries use a direct `url`; `type` defaults to `http`. For subscriptions that require conversion, set the provider's `__sub-store.format: mixed`. Optional `__sub-store.bwcounter` supplies display usage when subscription headers have none. Common affix stripping is opt-in through `__sub-store.strip-common-affixes: true`. Provider names do not automatically prefix proxy names; set `override.additional-prefix` explicitly.

For a JMS bandwidth counter, set `proxy-providers.JMS.__sub-store.bwcounter` to the complete `getbwcounter.php` API URL in each target profile. The API's `monthly_bw_limit_b`, `bw_counter_b`, and `bw_reset_day_of_month` fields supply remaining traffic and the monthly reset day for `$info`. The reset day is not a subscription expiration date. Responses are cached for one hour; a failed refresh may reuse a valid stale response. Bwcounter values appear when the profile is built or published, and do not refresh independently in the client.

Names are normalized in order: optional common affix stripping, sequential name overrides, then the explicit prefix and suffix. Provider and group filters match these final names. Name overrides run sequentially and support JavaScript named capture replacements such as `$<number>`. Patterns use JavaScript regular expressions and accept a leading `(?i)` for case-insensitive matching. Invalid patterns fail the build.

A group's `use` accepts provider names, group names, and `$info`. Group names remain group references. `include-all-providers` imports every provider in profile order and excludes generated `$info` entries. Members are collected in order: explicit `proxies`, `use`, then `include-all-providers`, with stable deduplication. `filter` keeps imported proxy names, then `exclude-filter` removes matching names; explicit proxy members and group references retain their place.

Static proxies stay first, followed by provider proxies in profile order and generated information entries. Provider-local `dialer-proxy` references follow renamed proxies. Compilation removes `proxy-providers`, build metadata, group build directives, and every key beginning with `__` recursively. Use private keys such as `__health-check` to define YAML anchors and reuse them with `<<` merges. YAML merges are resolved before compilation.

Unknown or ambiguous references, duplicate proxy names, proxy/group cycles, and missing routing targets fail the build. Empty groups used by routing rules also fail unless a Mihomo group explicitly declares `empty-fallback: REJECT`; that group compiles to `proxies: [REJECT]` when no members remain. Unused empty groups can be removed. Routing rules are preserved.

Mihomo Smart profiles declare `__sub-store.target: mihomo-smart` and support `type: smart` proxy groups alongside the regular Mihomo group types. Native Smart options such as `uselightgbm`, `collectdata`, `prefer-asn`, and root `lgbm-*` settings are preserved. Provider expansion, filters, YAML anchors, and `$info` work the same way as in Mihomo profiles.

## ⌨️ Build

Install dependencies from a checkout and put `mihomo` on `PATH` for Mihomo builds. For Mihomo Smart, install the [Smart core](https://github.com/vernesong/mihomo/releases/tag/Prerelease-Alpha) as `mihomo-smart` on `PATH`:

```bash
bun install
bun run ./cli/bin/sub-store.ts build mihomo profiles/mihomo.yaml -o artifacts/mihomo.yaml
bun run ./cli/bin/sub-store.ts build mihomo-smart profiles/mihomo-smart.yaml -o artifacts/mihomo-smart.yaml
bun run ./cli/bin/sub-store.ts build stash profiles/stash.yaml -o artifacts/stash.yaml
```

The installed package exposes the same commands through `sub-store`. Root `__sub-store` metadata is optional when building locally. If `__sub-store.target` is present, it must match the selected build command. The legacy `sub-store` spelling remains accepted for root and provider metadata; conflicting aliases fail validation. Use `__sub-store` in new profiles. Native secrets, including a Stash Tailscale auth key, belong directly in the relevant native proxy definition.

Each build writes YAML and a sibling `.metadata.json` file with owner-only permissions. The metadata contains response headers. Missing usage fields do not create information entries. A generated `Subscription-Userinfo` field is aggregated only when every header-based provider supplies that field. Bwcounter usage is display-only.

Mihomo and Mihomo Smart output receive schema and reference checks followed by `mihomo -t` or `mihomo-smart -t` using the corresponding installed executable. Stash output receives schema and reference checks. These checks do not establish connectivity or runtime routing behavior; verify the generated profile in its client. Treat profiles, cached provider responses, and generated artifacts as secrets.

## ☁️ Publish to Cloudflare

Add `__sub-store.id` and `__sub-store.target` to each profile you want to publish. New IDs use 20 uppercase Crockford Base32 characters; existing UUIDs remain supported. Separate Mihomo, Mihomo Smart, and Stash profiles may share an ID. Duplicate `(id, target)` pairs fail before upload.

Create `~/.config/sub-store/config.toml`:

```toml
token = "<upload token>"
base-url = "https://subs.liblaf.me"
```

```bash
sub-store publish                       # Recursively reads ~/.config/sub-store/profiles
sub-store publish /path/to/profiles
sub-store publish /path/to/profile.yaml
sub-store publish --config /path/to/config.toml
```

The CLI recursively discovers non-hidden `*.yaml` files, sorts them by path, and builds each profile for its declared target before any upload begins. You can organize profiles as `all/mihomo.yaml`, `all/stash.yaml`, `own/mihomo.yaml`, and `own/stash.yaml`. The success count reports profile files; those four files publish through two uploads grouped by subscription ID. Hidden folders and directory symlinks are skipped. Empty folders, build failures, and upload failures cause a nonzero exit.

Add a Smart variant such as `all/mihomo-smart.yaml` with the same ID and `target: mihomo-smart`; it is discovered automatically and published as a separate artifact in the same upload.

The default config and profiles folders follow `XDG_CONFIG_HOME` when set. `SUB_STORE_API_TOKEN` and `SUB_STORE_URL` override `token` and `base-url` respectively. A missing default config is allowed when the token comes from the environment; an explicitly selected file must exist. `base-url` defaults to `https://subs.liblaf.me`. HTTPS is required except for localhost development. The CLI sends the upload token in an `Authorization: Bearer` header and refuses redirects. Keep `config.toml` private, for example with `chmod 600 ~/.config/sub-store/config.toml`.

Configure the Worker upload secret and deploy separately:

```bash
wrangler secret put SUB_STORE_API_TOKEN
wrangler deploy
```

`PUT /api/profiles/:id/artifacts` accepts any combination of `mihomo`, `mihomo-smart`, and `stash` artifacts, each containing a `body` YAML string and `metadata.headers`. Only `Subscription-Userinfo` is accepted as a metadata header; the complete request is limited to 10 MiB. Supplied targets update the corresponding `artifacts/<ID>/<target>.yaml` KV keys. KV writes are not transactional and may take time to propagate.

The Worker uses the `KV` binding in `wrangler.toml`. Download URLs are `/subs/<ID>/mihomo.yaml`, `/subs/<ID>/mihomo-smart.yaml`, and `/subs/<ID>/stash.yaml`; successful responses begin with a `#SUBSCRIBED <canonical URL>` marker. IDs are bearer credentials, so keep subscription URLs private.

Scheduling, systemd units, and local Mihomo installation and restarts are managed by the dotfiles repository.

#### 📝 License

Copyright © 2026 [liblaf](https://github.com/liblaf). <br />
This project is [MIT](https://github.com/liblaf/sub-store/blob/main/LICENSE) licensed.
