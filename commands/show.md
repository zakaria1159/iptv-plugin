---
description: Reprint a saved line's credentials and M3U links (read-only)
argument-hint: <server> <name|username> [--url <label|number|all>]
---

Run with Bash and show the output:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/iptv.mjs" <server> show <name|username> [--url <choice>]
```

This only reads the local history and `urls.json`; it creates and spends nothing. If an argument
is missing, ask me. Offer to copy either block to the clipboard (`pbcopy`).
