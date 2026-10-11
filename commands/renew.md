---
description: Renew an existing IPTV line
argument-hint: <server> <name|username> <1|3|6|12> [--url <label|number|all>]
---

Renew a line. Arguments: $ARGUMENTS

Runner (use Bash):

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/iptv.mjs" <server> renew <name|username> <duration> [--url <choice>]
```

1. If server, line name or duration is missing, ask me with a pick list (durations 1, 3, 6, 12).
2. Run it **without** `--yes`: it prints a `PLAN` line and renews nothing.
3. Show me the plan and wait for my explicit yes (it costs credits). A yes covers that plan only.
4. Rerun the same command with `--yes` appended and show the output verbatim.
5. Offer to copy the credentials block or M3U links to the clipboard (`pbcopy`).

For a line created outside this plugin, a 4th argument with its password is needed.
Never read out or print an API key.
