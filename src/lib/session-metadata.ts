import { z } from "zod";

/** The shape of `metadata.json`, as `upload_transcripts.py` in vanoostrum/craft writes it. */

const isoTime = z.iso.datetime({ offset: true });

const UsageCounts = z.object({
  input_tokens: z.number(),
  output_tokens: z.number(),
  cache_creation_input_tokens: z.number(),
  cache_read_input_tokens: z.number(),
});

/** Token counts per model name. */
const Tokens = z.record(z.string(), UsageCounts);

const Subagent = z.object({
  agent_id: z.string(),
  role: z.string().nullable(),
  started_at: isoTime.nullable(),
  ended_at: isoTime.nullable(),
  tokens: Tokens,
});

const Segment = z.object({
  step: z.string().nullable(),
  ticket: z.string().nullable(),
  started_at: isoTime.nullable(),
  ended_at: isoTime.nullable(),
  tokens: Tokens,
  subagents: z.array(Subagent),
});

/** Unknown fields are accepted and dropped at every level, such as `moved_from`. */
export const SessionMetadata = z.object({
  repo: z.string(),
  branch: z.string(),
  session_id: z.string(),
  tickets: z.array(z.string()),
  segments: z.array(Segment),
  event: z.string().nullable(),
  uploaded_at: isoTime,
});

export type SessionMetadata = z.infer<typeof SessionMetadata>;

/** The `repo` value of a session outside a repository. */
export const NO_REPO = "no-repo";
