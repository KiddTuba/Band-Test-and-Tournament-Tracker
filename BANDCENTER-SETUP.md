# Barking Battalion BandCenter 2.0

BandCenter 2.0 is a from-scratch rebuild of the original Band Test and Tournament Tracker around a voluntary, season-long championship model.

## What changed

- Chair Tests are now **Optional Playing Challenges**.
- Students are never assigned a zero for choosing not to challenge.
- Every student receives a persistent, pregenerated **BandCenter moniker**.
- Commissioner Mode can edit or regenerate any moniker at any time.
- Existing `data.json` students, Band Bucks, and chair-test score data are migrated automatically on first load.
- Challenge scores automatically generate Championship Points.
- Personal bests and 1+ point improvements earn configurable bonuses.
- Power Rankings update from challenge and tournament results.
- Every active student can enter Band Madness. Rankings determine seeding; testing does not determine eligibility.
- Tournament victories, Elite Eight, Final Four, Runner-Up, and Championship finishes award configurable points.
- Player Cards automatically show career highs, tournament wins, titles, and achievements.
- Broadcast Mode uses monikers and sports-network-inspired presentation graphics.
- Existing tournament sound files are retained.
- Local JSON backup remains available.
- Supabase cloud sync is built in and activates when credentials are provided.

## First launch

Open `index.html` through GitHub Pages or another web server. BandCenter will read the existing `data.json` and migrate the roster into BandCenter 2.0 if no BandCenter 2 local state exists yet.

The default Commissioner passcode is currently `admin`. Change it in `bandcenter-config.js` before classroom deployment.

## Turn on cloud sync

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Run the contents of `supabase-schema.sql`.
4. Open `bandcenter-config.js`.
5. Paste your Supabase Project URL into `supabaseUrl`.
6. Paste the Supabase anon/public key into `supabaseAnonKey`.
7. Commit the config change and reload BandCenter.

When connected, the top bar changes to **Cloud synced** and BandCenter stores the shared state in the `bandcenter_state` table.

## Classroom modes

### Broadcast Mode
Designed for projection and student viewing. It shows monikers, instruments, standings, player cards, brackets, championships, and season stories.

### Commissioner Mode
Designed for the director. It contains real student names, roster editing, Playing Challenge score entry, tournament creation, scoring rules, backups, and configuration controls.

Do not project Commissioner Mode when student privacy matters.

## Default Championship Point model

| Event | Points |
| --- | ---: |
| Any completed challenge | 10 |
| Score 7.0-7.9 | +25 |
| Score 8.0-8.9 | +40 |
| Score 9.0-9.49 | +60 |
| Score 9.5-9.99 | +80 |
| Perfect 10 | +100 |
| New personal best | +20 |
| Improve by 1.0+ | +15 |
| Tournament entry | +20 |
| Each round win | +25 |
| Elite Eight | +50 |
| Final Four | +75 |
| Runner-Up | +125 |
| Champion | +200 |

Every value can be edited in Commissioner Mode > Settings without editing code.

## Files

- `index.html` - minimal BandCenter application shell
- `bandcenter-app.js` - application logic and React UI
- `bandcenter.css` - BandCenter broadcast graphics and animations
- `bandcenter-config.js` - deployment/cloud settings
- `supabase-schema.sql` - cloud state table and policies
- `data.json` - existing tracker data used as initial migration data
- existing `.mp3` files - retained sports/tournament audio

## Suggested deployment workflow

Keep `main` as the stable current app until BandCenter 2.0 is tested. The rebuild lives on the `bandcenter-2` branch. After testing, merge the BandCenter 2.0 pull request into `main` so GitHub Pages serves the new version.
