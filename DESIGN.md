---
name: כיתה פנויה
description: Free-room finder for one school, styled as parking-garage guidance signage.
colors:
  sign-blue: "#1546c0"
  sign-blue-edge: "#0c2c80"
  line-yellow: "#f4c20d"
  line-yellow-edge: "#a98600"
  lamp-green: "#17b26a"
  count-green: "#3fe08f"
  asphalt: "#14181f"
  board-cell: "#242b37"
  concrete: "#e9ebee"
  tile: "#ffffff"
  tile-edge: "#b7bec8"
  muted-ink: "#555e6c"
  claimed: "#fff3bf"
typography:
  display:
    fontFamily: "Karantina, 'Arial Narrow', system-ui, sans-serif"
    fontSize: "3.6rem"
    fontWeight: 700
    lineHeight: 0.85
    letterSpacing: "0.02em"
  body:
    fontFamily: "Heebo, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.35
  label:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 700
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  board: "14px"
spacing:
  gutter: "16px"
  gap: "8px"
  tile-gap: "10px"
  section: "26px"
components:
  key:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.asphalt}"
    rounded: "{rounded.md}"
    padding: "9px 14px 7px"
  key-selected:
    backgroundColor: "{colors.line-yellow}"
    textColor: "{colors.asphalt}"
  claim-key:
    backgroundColor: "{colors.sign-blue}"
    textColor: "{colors.tile}"
    rounded: "{rounded.md}"
    padding: "8px"
  room-tile:
    backgroundColor: "{colors.tile}"
    rounded: "{rounded.lg}"
    padding: "10px 12px 12px"
  counter-board:
    backgroundColor: "{colors.asphalt}"
    rounded: "{rounded.board}"
    padding: "6px"
---

# Design System: כיתה פנויה

## Overview

**Creative North Star: "שלט פנוי"**

The school building reads like the guidance signage at a parking garage entrance: every floor announces how many rooms are free, and every free room is a lit lamp. A student standing in a corridor between lessons reads the answer in one glance and walks there.

The page is a working screen, not a poster. The world contributes four things only: the sign-blue header with its line-paint hazard strip, condensed sign numerals, moulded keys that physically press, and the lamp.

**Key Characteristics:**
- Sign-blue header closed by a yellow and black hazard strip.
- Every control is a moulded key with a coloured lower edge that travels down when pressed.
- An asphalt counter board with green free-counts per floor.
- The room number is the tile's only headline, set at sign scale.
- Lamp size encodes how many lessons in a row the room stays free.

## Colors

Restrained ground (concrete grey, white tiles) with a committed sign shell (blue header) and three colours that each do one job.

- **Sign Blue** (`--blue`, #1546c0): the header plate and the claim key. Never used for decoration elsewhere.
- **Line Yellow** (`--yellow`, #f4c20d): selection (the pressed day and hour keys), section rules under floor headings, and focus rings. **The Yellow Means Selected Rule.** Nothing unselected is yellow; a yellow button reads as already pressed.
- **Lamp Green** (`--lamp`, #17b26a; `--count` #3fe08f on asphalt): free. Only lamps and free-counts use it.
- **Asphalt** (`--asphalt`, #14181f): the counter board and the hazard strip's dark band.
- Dark scheme swaps the concrete ground and tiles for near-black and graphite (`prefers-color-scheme: dark`); blue, yellow and green stay.

## Typography

**Display:** Karantina 700 (Google Fonts). Condensed sign numerals for the site name, room numbers, free-counts, floor digits and dialog titles. Always with `font-variant-numeric: tabular-nums` where numbers line up.
**Body:** Heebo 400/500/700 for everything else.

**The Numbers Are Signs Rule.** Any number a student scans for (room, count, floor) is set in the display face at sign scale. Times and dates stay in Heebo.

## Elevation

Depth is physical, not ambient: every pressable surface sits on a solid lower edge (`0 4px 0 var(--e)`) plus a short soft shadow. Pressing moves the surface down by 3px and collapses the edge to 1px, so the key looks pushed in. The selected day and hour key stays pushed in.

**The Edge Is The Affordance Rule.** If it has an edge, it can be pressed; if it can be pressed, it has an edge. Static readouts are flat.

## Components

- **Key** (`.chip`, `.go`, `.hk`, dialog buttons): `--e` sets the edge colour per variant. New buttons join the key selector list in the stylesheet.
- **Header key** (`.hk`): dark blue on the blue header for install and the teacher-search link; never yellow.
- **Counter board** (`.board`, `.lv`): total free-count, then one cell per floor; a cell jumps to its floor.
- **Room tile** (`.room`): lamp (top corner, size from `--s`), room number, class label, "free until", claim key. Claimed by you (`.room.taken`): claimed-yellow ground, hollow ring instead of a lamp, a quiet underlined "שחרר" text button far from the claim key.
- **Dialog**: tile ground, display-face title, keys at the bottom.
- **Icons**: inline SVG, 2px round stroke (`.ic`). No emoji in the interface.

## Motion

- Key press: 90ms `cubic-bezier(.16,1,.3,1)` on transform and shadow.
- Entrance after the student picks a day or hour (`#result.enter`): the first 12 tiles rise 8px (260ms, 22ms stagger), their lamps light from 40% scale (420ms), the counts roll up (300ms). Background refreshes never replay it, and the list re-renders only when claims actually changed.
- Dialogs rise in 200ms.
- `prefers-reduced-motion: reduce` turns all of it off.

## Do's and Don'ts

- Do keep every number a student scans in the display face.
- Do add any new button to the key selector list so it gets the edge and press.
- Do keep the release action quiet and away from the claim key.
- Don't use yellow for anything that is not selected, a section rule or focus.
- Don't use emoji or Unicode glyphs as icons.
- Don't add motion that runs on every refresh or animates off-screen tiles.
- Don't add libraries; everything is CSS in `index.html`.
