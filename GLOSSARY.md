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
The GitHub repository a session worked in, as `<owner>/<repo>`, such as `vanoostrum/craft`. A session outside a repository has none, and the Projects page shows it under "No repository". Until the product plan builds the project level, the Projects page lists repositories, not projects.
_Avoid_: Repo name, project (the product plan defines the project level)

**Ticket**:
A Linear ticket that a session names, by its key, such as `CRAFT-62`. A key that Linear does not know is not a ticket.
_Avoid_: Issue
