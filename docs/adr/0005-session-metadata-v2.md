# Craft writes the numbers into metadata.json; the Console only adds them up

The Console needs, per segment, the craft version, the model, the craft time, and the waiting time, and it needs a one-shot spec session split per ticket. All of that is in the transcripts, but the transcripts are about 110 MB of gzip on 2026-11-18, and reading them on each request would break ADR 0002. So craft's upload hook (`plugins/craft/hooks/upload_transcripts.py` in `vanoostrum/craft`) computes the numbers when it uploads, and writes them into `metadata.json`. The Console reads only `metadata.json`, as before.

These are the fields that the Console reads, added to each segment. The names are a contract between the two repositories:

| Field           | Type           | What                                                                                                                             |
| --------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `craft_version` | string or null | The version in craft's `plugin.json` when the step ran, such as `2.9.0`. Null when it is not known.                              |
| `model`         | string or null | The model of the step's own turns. Subagents keep their own tokens per model.                                                    |
| `work_seconds`  | number         | Craft time: the gaps between transcript lines, except the gaps that end with an incoming message.                                |
| `wait_seconds`  | number         | Waiting on the owner: the gaps that end with an incoming message: a `queue-operation` `enqueue` line, or a typed prompt.         |
| `brief`         | string or null | For a `craft:brainstorm` or `craft:setup` segment: the URL of the Linear document `Brief: <name>` that it wrote. Null otherwise. |

A one-shot spec session gets one segment per ticket that it specifies, so its cost lands on each ticket, not on the last one it names.

A re-process command in craft rebuilds `metadata.json` of every stored session from its `session.jsonl.gz`, once, so old sessions get the same fields. For a session from before craft recorded its version, it takes the version from the session's time and the times of craft's release tags, where only one release fits. Otherwise `craft_version` is null.

The Console accepts a session without these fields. A missing `craft_version` counts as an unknown version, and missing times count as no time.

## Consequences

The changes are three tickets in the Craft Linear project. They reach the bucket only after a craft release. The Console tickets build and test on synthetic fixtures with these fields, so they do not wait for craft. The live numbers are right once craft is released and the re-process has run.
