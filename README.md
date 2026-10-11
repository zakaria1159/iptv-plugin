# iptv

Create and renew IPTV lines on your panel's servers from Claude, with a `/iptv` command.

## Setup (3 steps)

1. Install the plugin in Claude (add this repo as a plugin marketplace, then install `iptv`).
2. Create `config.env` in the plugin folder (git-ignored) or `~/.config/iptv/config.env`,
   one key per server. The name before `_API_KEY` is the server name you type in `/iptv`:

   ```
   TREX_API_KEY=your-reseller-api-key
   TREX_API_URL=https://activationpanel.ru/api/api.php   # optional, this is the default
   ```

   Keep this file private. The plugin itself contains no credentials.
3. Check it works (read-only): `/iptv trex credits`

Requires Node 18+.

## Usage

Type `/iptv:` and pick a command from the menu; each one shows its arguments.

| Command | Arguments |
|---|---|
| `/iptv:create` | `<server> <1\|3\|6\|12\|demo> <package> <name> --url <label\|number\|all>` |
| `/iptv:renew` | `<server> <name\|username> <1\|3\|6\|12> [--url <label\|number\|all>]` |
| `/iptv:show` | `<server> <name\|username> [--url ...]` (read-only) |
| `/iptv:credits` | `<server>` (read-only) |
| `/iptv:list` | `<server>` packages (read-only) |
| `/iptv:urls` | `<server>` stream URLs (read-only) |

Leave arguments out and Claude asks for them with pick lists.

Examples: `/iptv:create trex 3 morocco John --url main`, `/iptv:renew trex John 6`

- `<server>` is the name before `_API_KEY` in config.env (case-insensitive).
- `<package>` matches a package name returned by that server.
- `--url` picks from `urls.json` by label, by number, or `all`.
- `demo` uses one demo ticket on the upstream panel.
- Create and renew show a plan first and only run after you confirm.
- Output is "username - password - server url" lines plus full M3U links.
- Creates M3U lines only. Disable/enable is not supported.
- Lines you create are remembered in `~/.config/iptv/lines.json` so you can renew by name.

## urls.json

```
{ "trex": { "main": "http://host:port", "backup_1": "http://host2:port" } }
```

Put it in the plugin folder (git-ignored) or `~/.config/iptv/urls.json`.
