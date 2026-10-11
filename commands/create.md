---
description: Create an IPTV line (M3U) on a server
argument-hint: <server> <1|3|6|12|demo> <package> <name> --url <label|number|all>
---

Create a line. Arguments: $ARGUMENTS

Runner (use Bash):

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/iptv.mjs" <server> <duration> <package> <name...> --url <choice>
```

1. **Missing parts:** if any of server, duration, package, name or URL is missing from the
   arguments, ask me for each missing one with a pick list instead of guessing:
   - server: from `iptv.mjs` run with no config errors; ask me if unsure (names come from the
     `<NAME>_API_KEY` keys in config.env, never print the keys)
   - duration: 1, 3, 6, 12 or demo
   - package: run `iptv.mjs <server> list` and offer the packages it prints
   - URL: run `iptv.mjs <server> urls` and offer the labels, plus "all"
   - name: free text
2. Run the command **without** `--yes`. It prints a `PLAN` line and creates nothing.
3. Show me the plan and wait for my explicit yes. A yes covers that one plan only.
4. Rerun the exact same command with `--yes` appended, then show me the output verbatim.
5. Offer to copy either block to the clipboard (`pbcopy`): the "username - password - server url"
   lines, or the M3U links.

If the script reports an unknown or ambiguous server, package or URL, show me the options and ask.
Never read out or print an API key.
