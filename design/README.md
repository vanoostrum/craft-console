# Design gallery

The visual spec of each screen of Craft Console. The rules are in `gallery.md` of the `craft:rules` skill.

Current stage: 2

Platforms: desktop, mobile

Desktop is the primary platform. v1 is desktop only; on mobile the layout must not break, and no phone design is drawn (product brief).

The look is "B · Console" from the product brief's canvas: dark, dense, tables, a top tab bar.

## Contents

- `pages/<screen>/<state>.html`: one page per screen state.
- `components/`: each component in its states (default, hover, focus). Start at `components/index.html`.
- `patterns/`: the rules for combining components. Start at `patterns/index.html`.
- `gallery.css`: the one stylesheet. The classes `is-hover` and `is-focus` exist only here, to draw hover and focus on a static page.

The design checks in `tests/design/` run over these pages and the app's HTML routes: WCAG AA contrast, visible elements, and at most one primary action per page that stands out.
