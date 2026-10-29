# UI Mockup

The agreed UI mockup, made as a design canvas: https://claude.ai/artifact/WZ6vtoJNekshgK1kjFLpzp (private to the owner).

These files are the canvas source. They use the canvas runtime (`support.js`, `<sc-if>`, `<sc-for>`, `{{holes}}`), so they don't open on their own in a browser. Read them for **layout, spacing, copy, colors and behavior**; don't copy the markup into the app. Rebuild the screens with React, Tailwind and shadcn/ui.

| File | Shows |
| --- | --- |
| `app-desktop.html` | The full desktop app: sidebar, header, Today, Calendar (day/week/month), To-dos, Weekly review, Settings, the New task/event dialog with repeat options, and the event details dialog with delete scope. The `renderVals()` script at the bottom has the mock data and all the derived styles. |
| `today-phone.html` | Today on a 390px phone: "Now" card, schedule, to-do list, bottom tab bar, floating + button. |
| `sign-in.html` | Sign-in page. |

Screenshots of each screen, in light and dark mode, are in `context/screenshots/`.

## Design tokens

Use these exact values. Names in brackets are the shadcn/ui variable each maps to (see `01-project-setup-spec.md`).

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| bg [`--background`] | `#F4F6F9` | `#0D1015` | Page background |
| surface [`--card`, `--popover`] | `#FFFFFF` | `#141920` | Cards, sidebar, header, dialogs |
| sunken [`--muted`, `--secondary`] | `#EDF0F4` | `#1B2129` | Segmented controls, progress tracks, note boxes, hover |
| border [`--border`, `--input`] | `#DFE3EA` | `#29303B` | Hairlines, inputs |
| text [`--foreground`] | `#141922` | `#E5E8ED` | Body text |
| muted [`--muted-foreground`] | `#576072` | `#9BA5B4` | Secondary text, labels |
| accent [`--primary`, `--ring`] | `#1D5BD6` | `#2D64D8` | Buttons, now line, today circle |
| on-accent [`--primary-foreground`] | `#FFFFFF` | `#FFFFFF` | Text on primary buttons |
| accent-text [`--primary-text`] | `#1A55C9` | `#8AB0FF` | Blue text and links |
| blue-soft [`--primary-soft`] | `#E6EEFC` | `#172540` | Selected nav, blue events, Now pill |
| blue-ink [`--primary-ink`] | `#173F8C` | `#B3CBFF` | Text on blue-soft |
| green [`--success`] | `#1F8A52` | `#3DBE7B` | Done checkboxes, progress, completion bars |
| on-green [`--success-foreground`] | `#FFFFFF` | `#06140C` | Checkmark on green |
| green-soft [`--success-soft`] | `#E2F3E9` | `#12291D` | Green events |
| green-ink [`--success-ink`] | `#17643C` | `#86DDB0` | Text on green-soft, minutes tag, positive deltas |
| orange [`--warning`] | `#A3510B` | `#EFA35F` | Missed, done late, negative deltas, delete |

Rules:

- **Blue is the main color** (actions, navigation, current item, time stats). **Green always means done** (checkmarks, completion). **Orange means missed or late.** Don't use red/green to signal good/bad.
- Fonts: **IBM Plex Sans** (400/500/600) for UI, **IBM Plex Mono** (400/500) for times, counts and numbers.
- Radii: 8px buttons/inputs, 10px cards, 12px dialogs, 5px checkboxes. Hairline 1px borders, no heavy shadows except dialogs.
- No gradients, no emoji, no left-border accent cards.
- Tap targets at least 44px (checkboxes are a 20px box inside a 44px button).
