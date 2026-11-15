---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# index.html — free-room finder (main screen)

Scope: the only student-facing screen. Visitor mode: Operate. Phone only, RTL Hebrew.
Audience and job: a student in a corridor finds a free classroom for the current lesson and optionally claims it.
Constraints: one static file, CSS-only motion, no libraries, smooth on weak phones, light and dark schemes.
Unresolved: teacher search (partner's feature) gets its visuals once it exists.

## Direction contract

THESIS: "שלט פנוי" — the building reads like a parking garage's guidance signage: every floor announces how many rooms are free, every free room is a lit lamp. Refuses the white-card-grid-under-a-purple-gradient app.

OWN-WORLD: signage blue (#1546c0) shell, line-paint yellow (#f4c20d) for selection and rules, lamp green (#17b26a) for free, concrete grey ground, asphalt (#14181f) for the counter board. Condensed Karantina numerals at sign scale, Heebo for text. Controls are moulded keys with a coloured lower edge that travel down when pressed. A yellow-black hazard strip closes the header.

STORY: the student sees the current lesson, reads the per-floor free counts, spots the nearest floor, reads a room number at a glance, taps "אני הולך/ת לשם".

FIRST VIEWPORT: blue header (name at ~54px, date, the current lesson as an asphalt plate with yellow numerals on the left); day keys; hour keys; the floor counter board (one cell per floor: big grey floor digit, big green free count) which jumps to that floor; then the first floor's room tiles, two per row, room number ~58px, lamp top-left, claim key at the tile's bottom.

SIGNATURE: lamp size encodes how long the room stays free (bigger = free longer); state reads without colour (filled lamp = free, hollow yellow ring = yours). Motion grammar: key travel 90ms on press, lamps light in a short stagger when the hour changes, count digits roll once. Release ("שחרר") is a quiet text button, apart from the claim key.

FORM: candidate 6 of 7 on the ordered list (lit "פנוי" sign / garage guidance). Seed key f1bfd7e5.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
