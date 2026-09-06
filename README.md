# mydaddyfriend.lol

A yellow page with no purpose whatsoever.

You upload a photo of a friend, the face gets cut out and pasted onto an avatar with
cat ears, a lace harness and a whip in hand. You give it a name that floats above its
head like a videogame nameplate, and every time you smack it you hear a whip crack and
a slap, its eyes close, its mouth opens and it moans *"OH YEAH DADDY"*.

Everything happens **inside your browser**. The photo is never uploaded anywhere.

## Using it

1. `📸 add a face` — or drag a photo onto the page, or paste one with `Ctrl+V`.
2. `✏️ name it` and type a name.
3. Pick a **pose** (stand, kneel, lie down), a **haircut** (long, short, bald), what it
   **holds** (whip, paddle, flogger or nothing) and what **gear** it wears (blindfold,
   ball gag with strap, collar + leash, cuffs, rope).
4. If the skin or hair colour looks off, change it in the swatch strip — 10 shades of
   each plus a free colour picker. `↺ take the colors from the photo` goes back to the
   ones sampled from the photo.
5. Smack it. Then smack it again. Every 10 smacks it levels up, and every so many
   levels it earns a new **rank** — from `🥩 FRESH MEAT` up to `👑 IMMORTAL` at level 100.
6. `💸 MONEY RAIN` throws cash at it and makes it dance for the length of the song.

The photo, the name and the counter live in the browser's `localStorage`, so they're
still there when you come back. `🗑️ clear` wipes them.

## How it works

### The face

- The photo goes through [face-api.js](https://github.com/vladmandic/face-api)
  (`tinyFaceDetector` + `faceLandmark68TinyNet`, ~270 KB of models) to find the **eyes
  and mouth**.
- The eye positions give scale, rotation and tilt, and the face is drawn centred into a
  560×560 canvas. That canvas is clipped with a **face-shaped mask** — round forehead,
  pointed chin, blurred edges — so you get a cut-out face and not a ball with a photo
  stuck on it. The avatar's front hair strands are drawn on top and hide the seam.
- The head is drawn at **140%**, so the face fills 44% of the stage width. At the
  original size the friend simply wasn't recognisable, which is the whole point — it's
  the Elf Yourself trick: big head, face first, costume second. The hair and cat ears
  are **drawn at that size** rather than scaled up with the head; scaling them made them
  grow lengthwise too, until the strands reached the hips and the ears collided with the
  nameplate.
- Closed eyelids and an open mouth are placed on top of that texture at the exact
  coordinates of the detected features. Each patch is coloured by sampling the skin next
  to the feature, so it blends into the photo.
- **The avatar is painted with the photo's own colours**: the skin tone at the edge of
  the face paints the neck, arms and legs, and the hair is sampled from an arc above the
  eyes. That's why the body meets the face instead of looking like a helmet.
- If no face is found, it makes a centred crop and opens the adjust panel so you can
  line it up by hand with the sliders.
- Colours can be overridden by hand from the swatch strip. A hand-picked colour beats
  the sampled one and is saved; hand-picked hair isn't darkened, so platinum blonde or
  pink stays that way.

### Levels and ranks

A level is 10 smacks, flat, forever. That curve is deliberately **not** progressive: making
later levels cost more would have demoted every doll that already exists, and someone who
ground their way to level 100 shouldn't wake up at level 40.

What escalates instead is the **rank**, which changes in jumps — that's what makes going up
feel like something rather than a bigger number:

| Level | Rank | What changes on the stage |
|---|---|---|
| 1 | 🥩 FRESH MEAT | plain |
| 5 | 🐶 GOOD BOY | a faint aura appears |
| 10 | ⛓️ SUB | aura grows |
| 20 | 😈 BRAT | grows again |
| 35 | 🔥 PAIN ENJOYER | the sunburst starts spinning faster |
| 50 | 💖 DADDY'S FAVORITE | the aura starts pulsing |
| 75 | ⭐ LEGEND | the sunburst turns **white** |
| 100 | 👑 IMMORTAL | the sunburst turns **black**, aura goes dark and beats fast |

Each rank's aura carries its own colour, separate from the colour of its text. That isn't
decoration: the page background is `#ffe000`, so gold — the obvious colour for the top two
ranks — is invisible on it. LEGEND and IMMORTAL keep gold *text* and get their weight from
changing the background instead, which is the only thing that makes a level 100 doll read as
standing somewhere else rather than in the same scene with a higher number.

Levelling up is a moment, not a silent counter tick: a banner slams in, confetti in the
rank's colour bursts out, the doll gets shaken, the stage flashes, and a rising arpeggio
plays 280 ms after the click — after the whip and the slap, which own the first 180 ms.
Earning a **new rank** is the same thing, bigger and longer, with an extra shimmer on top.
Under the counter, a line tells you how many smacks are left until the next rank.

### The sound

- **All audio is files** in `sounds/`, played through one shared `AudioContext`: the
  whip, the phrases and the song. Phrases used to be spoken by the browser's
  `SpeechSynthesis` and it was impossible to keep working — in several browsers it emits
  the utterance and nothing plays, firing neither `start` nor `error`. It survives only
  as a fallback for when the folder is missing, with a selector in the panel to switch
  back to it. See [`sounds/README.md`](sounds/README.md).
- A whip is two sounds, not one: the **crack** of the whip through the air comes from
  the mp3, and the **slap** of it landing is synthesised on top — three layers (the
  mid-band snap of skin, a low body thump and a bit of high air so it doesn't sound like
  a kick drum) with a random pitch nudge so two clicks in a row aren't identical.
- Audio files are **measured, not trusted**. On load the code finds each file's first
  audible sample and its peak; playback skips the leading silence, and the peak says
  exactly when the hit lands, so the slap sits on top of it and the phrase comes in
  150 ms after. The current `whip.mp3` carries 346 ms of silence before the crack — left
  alone, the whip landed 400 ms after the click and the whole page felt like it was
  lagging. Drop in any mp3 you like; nothing needs trimming.
- **Money rain**: the button throws bills **from the viewer's side of the screen**
  toward the character while it dances, for as long as the song lasts. It isn't a fake
  scale-up — it animates real `translateZ` inside a container with `perspective`, with
  the vanishing point set where the character is. A bill goes from 286 px wide as it
  leaves you to 45 px as it arrives. They're a drawn SVG, not emoji. The dance is CSS at
  one second per cycle. You can keep smacking it while it dances.

## Running it

Loose HTML, CSS and JS. No build, nothing to install. The only requirement is serving it
over HTTP — opened as `file://` the browser blocks the model loading:

```sh
python3 -m http.server 8000
# http://localhost:8000
```

## Deploying it

Any static host works — GitHub Pages, Netlify, Vercel, plain `nginx`. There is nothing
to configure: no server, no database, no API keys, no environment variables.

This one runs on **GitHub Pages at `mydaddyfriend.lol`**. Two halves have to agree:

- **In the repo**: the `CNAME` file at the root holds the bare domain, one line, nothing
  else — no `https://`, no trailing slash, no `www`. GitHub reads it on every deploy and
  a malformed one silently unsets the custom domain.
- **In the DNS**: four `A` records on `@` pointing at GitHub's Pages addresses, four
  `AAAA` for IPv6, and a `CNAME` on `www` pointing at `<user>.github.io`. Don't copy the
  addresses from here — they're in
  [GitHub's docs](https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site),
  and they're also whatever `<user>.github.io` resolves to right now.

Then turn on **Enforce HTTPS** in Settings → Pages, once the certificate is issued. It
takes a few minutes after the DNS propagates and stays greyed out until then.

## Files

```
CNAME                 the custom domain, read by GitHub Pages on every deploy
index.html            the page and the avatar (SVG in two layers, behind and in front of the face)
privacy.html          the privacy policy
styles.css            everything yellow, plus the face-shaped mask
app.js                detection, cut-out, colours, expression, whip, money rain
sounds/               the whip, the phrases and the song (see sounds/README.md)
vendor/face-api/      face-api.js + the two small models (MIT)
```

`face-api.js` is vendored on purpose: with no CDN, the page works even if the CDN is
down and it doesn't tell anyone you opened it. It's 1.3 MB, fetched in the background
only once the browser goes idle — not on page load.

## Privacy

Full policy: [privacy.html](privacy.html). Short version below.

The photo never leaves the device. There is no upload, no analytics, no cookies, no
third-party requests of any kind — the page only ever fetches files from its own origin.
The photo is stored as a data URL in `localStorage` — downscaled to 1200 px first if
it's bigger than that — which lives in that one browser and is readable by nobody else;
`🗑️ clear` deletes it.

## License

`vendor/face-api/` is [face-api.js](https://github.com/vladmandic/face-api) by Vladimir
Mandic, MIT — see `vendor/face-api/LICENSE`.

The site itself has **no license file yet**, which by default means all rights reserved:
nobody can legally reuse it. If you want people to be able to fork it, add a `LICENSE`
(MIT is the usual pick for something like this). The clips in `sounds/` are sound effects
collected for the joke and aren't yours to relicense either way.
