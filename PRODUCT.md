# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Students at one Israeli high school (timetable source: blich.shahaf.site). They open the site on their phone, between lessons or during a free period, standing in a corridor, to find an empty classroom right now. Everyone uses a phone; some phones are old and slow.

## Product Purpose
Shows which classrooms are free at a chosen day and lesson hour, grouped by floor, and until when each stays free. A student can claim a room ("אני הולך/ת לשם") so others stop seeing it, and release it. Success: a student finds and reaches a free room within seconds.

## Positioning
Built from the school's real timetable and its daily changes, refreshed every 30 minutes, plus live claims by other students. It is specific to this one building and its room numbers.

## Operating Context
- One-handed phone use, short visits, repeated many times a day.
- Installed to the home screen as a PWA by some users.
- A Telegram bot and an admin page exist beside the site.

## Capabilities and Constraints
- Single static file `index.html` (HTML, CSS, vanilla JS), hosted statically. No build step, no libraries.
- Hebrew, right-to-left.
- Data: `data.json` (days, hours, busy rooms). Claims: Firebase Realtime Database over REST, max 2 claims per student per day.
- Motion: CSS only, subtle and fast; 3D depth done in CSS, no 3D libraries. Must stay smooth on weak phones.
- Light and dark colour schemes both exist today.
- Undecided: teacher search (a partner is building it; its visuals wait until it exists).

## Brand Commitments
- Name: כיתה פנויה.
- Owner's binding constraint: must not look like a typical AI-generated design; a significant redesign is wanted.

## Evidence on Hand
- Real room list and timetable in `data.json`. No testimonials, usage numbers, or marketing claims exist; none may be invented.

## Product Principles
1. The answer first: free rooms for right now are visible without any tap.
2. One thumb, one second: every control is reachable and responds instantly.
3. Honest data: a room that looks free may still be occupied, and the site says so.
4. Light on the phone: nothing that slows an old device.
