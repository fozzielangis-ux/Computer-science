# 🎉 Sydelle's Birthday Bash

A 3D party game made for Sydelle's birthday. It runs in any modern web browser on a phone, tablet or computer.

**To play:** open `index.html` in Chrome, Edge, Safari or Firefox. It's one self-contained file, so you can double-click it, send it to someone, or host it on GitHub Pages. No internet connection is needed.

## What's inside

You can play the games as one party tour or pick them one at a time from the menu.

| | Game | How to play |
|---|---|---|
| 🎈 | **Balloon Pop** | Pop as many balloons as you can in 60 seconds. Pop the letters **S‑Y‑D‑E‑L‑L‑E** in order for a big bonus, grab gold stars and +5s balloons, and don't pop the grumpy storm clouds. |
| 🎂 | **Cake Tower** | Party balloons bring in cake layers. Tap to drop each one and build the tallest cake you can. Perfect drops earn bonuses, but if the tower leans too far it topples. |
| 🎁 | **Present Dash** | Run with Sprinkle the cupcake across Candy Cloud Land. Swipe or use the arrow keys to change lanes, jump over presents and slide under banners. Grab balloons to float over everything. |
| 🕯️ | **Make a Wish** | The finale. Everyone sings *Happy Birthday* along with the karaoke lyrics. Then you blow out the candles by blowing into the microphone, holding the button, or tapping the candles, and the fireworks start. |

Best scores are saved in the browser.

### Controls
- **Phone or tablet:** tap and swipe.
- **Computer:** click, or use the arrow keys / WASD and Space. Press Esc to pause.

## Personalise it

You can add these to the end of the link:

| Setting | Example | What it does |
|---|---|---|
| `age` | `index.html?age=12` | Puts 12 candles on the cake and says "Happy 12th Birthday". |
| `from` | `index.html?from=Your%20Name` | Signs the birthday card. |
| `name` | `index.html?name=Sydelle` | Changes the name, which is already Sydelle. |

You can combine them, for example `index.html?age=12&from=Alex`.

To change the birthday message itself, edit `CONFIG.message` in `src/main.js` and rebuild.

## How it's made

- **3D graphics:** [three.js](https://threejs.org), with physically based materials (glossy latex balloons, metallic foil letters and frosting). It uses a custom party lighting environment, soft shadows, a bloom glow effect and ACES tone mapping.
- **Everything is built in code.** There are no 3D model files. The balloons, cakes with dripping frosting, Sprinkle the cupcake, gifts, lollipops and fireworks are all made from shapes, curves and particles.
- **All sounds and music are synthesised live** with the Web Audio API. That includes the pops, chimes, party horns, fireworks, a little original party soundtrack, and "Happy Birthday" (traditional, public domain) on a music box.
- **Fonts:** [Fredoka](https://fonts.google.com/specimen/Fredoka) and [Pacifico](https://fonts.google.com/specimen/Pacifico), both under the SIL Open Font License. They're embedded in the file, and Fredoka is also turned into the 3D balloon letters.
- **Graphics quality** adjusts automatically so the game stays smooth on phones.

## Developing

```bash
npm install
npm run build     # bundles everything into index.html
npm run watch     # rebuilds on every change
```

The source code is in `src/`:

- `core/`: the engine, audio, UI and environment.
- `models/`: the 3D models.
- `fx/`: confetti and particles.
- `scenes/`: one file per game.
