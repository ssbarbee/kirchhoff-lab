# Kirchhoff Lab

An interactive way to learn Kirchhoff's circuit rules. It draws a random circuit, asks you to find every current, then walks you through the full solution one step at a time.

**Open it:** https://ssbarbee.github.io/kirchhoff-lab/

## What's inside

- Four difficulty levels, from one loop to three loops with five unknown currents. Every circuit is randomly generated and has whole-number answers.
- A guided walkthrough:
  - reading the circuit
  - choosing current directions
  - writing the junction and loop equations
  - solving the system
  - interpreting negative answers
  - a voltage "rollercoaster" for each loop
  - an energy check at the end
- Animated current flow and a walker that travels each loop.
- Circuit codes such as `L2-42`, so a whole class can work on the same circuit. You can also link to one directly: `…/kirchhoff-lab/#L2-42`.
- Light and dark themes. Resistors can be drawn with the IEC box or the US zigzag symbol.

It is a single self-contained `index.html` with no dependencies and no internet needed, so you can also download it and open it straight in a browser.

## Development

The app is built from the files in `src/`:

- `core.js`: generator and solver
- `view.js`: SVG drawing and animation
- `pages.js`: walkthrough steps
- `app.js`: navigation
- `head.html`: styles and page shell

```sh
./build.sh               # concatenates src/ into index.html
node test/core.test.js   # checks 6,000 generated circuits end to end
```
