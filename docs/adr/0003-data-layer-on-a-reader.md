# The data layer is pure functions on a reader

The data layer turns sessions and Linear tickets into the levels project, plan, milestone, ticket, and phase. It is pure functions on top of two small readers: one for the bucket and one for Linear. Each reader has a fixture version and a live version, and the setting `CONSOLE_DATA` picks one. So CI and the agents test the data layer with no network access and no secrets.

The fixtures are synthetic, never copied from the bucket or Linear, because the repository is public. They follow the real `metadata.json` shape, which the code records as a typed schema.

The live readers also work with no credentials in the app, because in a Claude cloud session the network proxy adds them for `storage.googleapis.com` and `api.linear.app`.
