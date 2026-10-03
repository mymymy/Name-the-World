# Tests

Sixteen programs that open the page in a real browser, tap it, type at it, and
check what it does. No framework: each one is a plain Node script that prints
what it found and exits non-zero if it found something wrong.

```
node test/run.mjs            all of them, about five minutes
node test/run.mjs --quick    the fast core, about two minutes
node test/run.mjs reach spread   just those
```

They need Playwright, which the page itself does not — nothing here ships:

```
npm install --no-save playwright
npx playwright install chromium
```

The page is found beside this folder and opened over `file://`, so there is
nothing to serve and no port to pick. A phone-shaped window, 390x844, because
that is where all of this is played and where every problem below was noticed.

## What each one is for

Every test here exists because something broke. That is the only reason any of
them were written, and it is worth saying which, because a test whose story is
forgotten is a test nobody dares delete and nobody trusts either.

| | guards | written because |
|---|---|---|
| `smoke` | every game starts and takes an answer | the floor: if this fails, nothing else is worth reading |
| `names` | no alias quietly takes a name off another place | aliases are claims on shared strings, and a new one can silently shadow a country that already answered to it |
| `scripts` | a name can be typed in its own script | 25 names the data offered could never be matched - `Российская Федерация` and the rest normalised to an empty string |
| `ambig` | a word naming two places names neither | typing `Korea` answered North Korea and marked you wrong. `United` silently became the United States |
| `cardhead` | the result card reads as it should | the score and the clock, and which of them leads |
| `enclaves` | an enclave is not swallowed by its host | the Vatican, San Marino, Monaco, Liechtenstein and Singapore were painted under their neighbours, so naming Italy turned the Vatican green |
| `ghosts` | nothing is reachable where nothing is drawn | up to 35 countries could be tapped while off the edge of the globe - Andorra and Monaco answering from the North Atlantic |
| `reach` | the small countries can be hit | the tiny ones used to be dots nobody understood; they are drawn true now and carry a skirt of ground around them |
| `fullzoom` | and each is a finger across at full zoom, small neighbours (Israel, Qatar) keep most of their own ground there, strips between two borders (Limbang, the Casamance) keep their middle, far-flung islands like Guadeloupe answer for their country, and nothing costs anybody anything at the opening view | the rule, as asked for: a 44px target at *some* zoom, not every one. The Gambia's reach once covered a fist of Senegal at the opening view, and the Vatican was a speck at every zoom. v165 then gave the West Bank's skirt every tap from Tel Aviv south, Bahrain 38% of Qatar, and Brunei all of Limbang |
| `bigkeep` | and the big ones keep their own taps | the counterweight to `reach`: every reach is a licence to steal, and this is the check that it isn't used |
| `caribbean` | the Bahamas do not take taps inside Haiti | reported from a phone. Five of forty-five points inside Haiti answered to the Bahamas |
| `gazareach` | Gaza has a reach of its own, at every zoom up to full | Palestine was scored as one country, so once the West Bank was big enough to hit, Gaza - a three-pixel sliver - lost its reach with it |
| `boardreach` | the same, on counties, states and boroughs | Rhode Island is 7px, Bristol 8, the City of London 1, and they tile rather than sit in a sea |
| `capreach` | a capital is a 7px dot and has a touch area | it had none. 0 of 398 near-miss taps found anything |
| `capcountry` | and its country answers for it | hit anywhere on France to be asked about Paris |
| `spread` | two dots on one spot are parted, and stay home | the Vatican and Rome are drawn a sixth of a pixel apart, which no amount of zoom separates |

## Things that have gone wrong in the tests themselves

Written down because each one cost an hour and each one will look like a bug in
the page when it happens again.

- **A click reports whole pixels.** A point checked at `x.7` is clicked at `x`.
  Verify the point you are going to click, not the one before rounding. This is
  what made `bigkeep` flaky, and the same effect was a real bug in the page.
- **Naming a place flies the map**, and the flight outlives the click that
  started it. Wait for the view to stop before measuring anything - and watch
  `lam0` as well as `k`, `tx` and `ty`, because the globe turns on its own
  animation.
- **A bounding-box centre is often in another country.** Kiribati's box is
  fourteen hundred pixels of Pacific; Palestine's middle is Israel. Find a point
  by asking the geometry whether it covers it.
- **`fitCurrent()` does not put the world back as it was** in every game, so a
  list of screen positions taken once is right for the first tap and off the
  side of the screen for the rest. Ankara turned up at (1397,-1359).
- **`elementFromPoint` answers null outside the window**, which looks exactly
  like "nothing is there". Bounds-check the point first.
- **The ask panel sits over the map.** A tap that lands on its input proves
  nothing; `closeAsk(true)` puts it away at once.
