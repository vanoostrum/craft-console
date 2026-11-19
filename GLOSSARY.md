# Craft Console

A dashboard that shows what craft's work on each project costs and how long it takes, from the session transcripts and the Linear tickets.

## Language

**Session**:
One Claude Code session of a craft step, with its `metadata.json` in the transcript bucket.
_Avoid_: Run, transcript (the transcript is the file, not the session)

**Transcript bucket**:
The Google Cloud Storage bucket `gs://craft-transcripts`, which holds the sessions. The app only reads it.

**Data source**:
Where the app reads its data: `fixtures` or `live`, set with `CONSOLE_DATA`.

**Fixtures**:
A synthetic data set in the repository, in the real shape of sessions and Linear tickets. CI and the agents use it.
_Avoid_: Mock data, sample data

**Live data**:
The real sessions from the transcript bucket and the real tickets from Linear.

**Reader**:
A module that fetches raw sessions or Linear tickets from one data source. The data layer builds everything else from what the readers return.

**Repository**:
The GitHub repository a session worked in, as `<owner>/<repo>`, such as `vanoostrum/craft`. A session outside a repository has none, and the Projects page shows it under "No repository".
_Avoid_: Repo name

**Ticket**:
A Linear ticket that a session names, by its key, such as `CRAFT-62`. A key that Linear does not know is not a ticket.
_Avoid_: Issue

**Project**:
One repository that runs on craft, such as NapTime in `vanoostrum/nap-time`. Its name is the Linear project that holds most of its tickets, or the repository name when no ticket has a Linear project. The levels below it are plan, milestone, ticket, and phase.
_Avoid_: Repo (a project is shown by name; the repository is its identity)

**Project page**:
The page of one project, at `/projects/<owner>/<repo>`: its totals, and the tickets × phases grid by plan, milestone, and ticket.

**Plan**:
A plan ticket from `craft:plan`, titled `Plan: <name>`. Its tickets are its sub-issues: a ticket is in a plan only when its parent's title starts with "Plan: ". The cost of the brainstorm and setup sessions of the brief that the plan ticket links counts toward the plan ticket.

**Brief**:
The Linear document `Brief: <name>` that `craft:brainstorm` or `craft:setup` writes. A plan ticket links it in its description. A segment and a plan ticket name the same brief when the document id at the end of their URLs is the same.

**Milestone**:
The Linear milestone `<plan name>: <milestone>` of a ticket. A plan shows its milestones only when it has more than one.

**Single tickets**:
The tickets of a project that belong to no plan.

**No ticket**:
The work of a project that names no ticket, such as a `craft:next` run on its own, and brief sessions whose plan does not exist yet.

**Phase**:
What a segment did: `plan`, `spec`, `design`, `build`, `review`, `merge`, or `other`. A segment with the stored step `plan`, `spec`, `design`, `build`, `review`, or `merge` has the phase of that name. Every other segment, such as a `brainstorm`, `setup`, or `next` segment, or a segment with no step, has the phase `other`. The stored step is the name of the craft step without `craft:`: a `craft:build` call stores `build`.
_Avoid_: Step (a step is the craft skill; the phase is the column)

**Segment**:
The part of a session from one craft step call to the next, with its own ticket, tokens, and times. `metadata.json` lists the segments of a session. In a spec session, a change of the current ticket also starts a segment.

**Cost**:
What the tokens of a segment cost at the Anthropic API list prices in the price table, in euros. Every session is priced with the current price table, so the same work always has the same cost.
_Avoid_: Spend, price (the price is per token)

**Price table**:
The API list price per model and token kind, and the fixed dollar-to-euro rate, with the date they were read. It lives in the code; a price change is a commit.

**Craft time**:
The working time of a segment: the gaps between transcript lines, except the gaps that end with an incoming message. `metadata.json` holds it per segment as `work_seconds`.
_Avoid_: Duration, wall-clock time

**Waiting on you**:
The gaps of a segment that end with an incoming message: craft waits for the owner. `metadata.json` holds it per segment as `wait_seconds`.

**Craft version**:
The version of craft that ran a segment, such as `2.9.0`, from `craft_version` in `metadata.json`. A segment without one, or with a value that is not three dot-separated whole numbers, has an unknown version. The Craft versions page shows it under "Unknown version".

**Craft versions page**:
The page at `/versions`: for each craft version, the average cost and craft time per phase per ticket, over all projects, and the change of the totals against the previous version. A phase counts toward the craft version that ran it.

**Max share**:
An estimate of the real money per project: the monthly price of the owner's Max plan, `CONSOLE_MAX_PLAN_EUR`, split over the projects by their cost in that calendar month. The month is in Europe/Amsterdam time, and a segment counts in the month it ended. It assumes that all Max use is craft.

**Shade by**:
The switch between cost and craft time for the grid shading and the phase bars.

**Phase mix**:
The bar that splits a project's cost, or its craft time, over the phases. Shade by picks which.

**Unreadable session file**:
A `metadata.json` in the transcript bucket that is not valid JSON or does not have the session shape. No page counts it. The Projects page, the project page, and the Craft versions page list it in a notice.
_Avoid_: Broken session, bad file
