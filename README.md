# Fate & Fortune — Chub Dice Roller

A visual dice stage built from [CharHubAI/stage-template](https://github.com/CharHubAI/stage-template), using its React/TypeScript runner, StageBase lifecycle, and Chub upload format. It sits beside the conversation on desktop and above it on mobile.

## What it does

- Animated dice tray, quick d4/d6/d8/d10/d12/d20/d100 presets, custom notation, individual dice, and a 20-roll history.
- Expressions such as `2d6+3`, `d20+5`, `d8+d6-2`, `4d6kh3`, and `2d20kl1`.
- Advantage/disadvantage for one d20 with modifiers; optional roll labels and target DC.
- Cryptographically random results with rejection sampling, calculated independently of the language model and animation.
- Panel results queued for your next human chat message, or practice rolls that stay out of model context.
- Chat commands that publish exact results in a Chub system message and instruct the model to use those totals.
- Message-level state restored on branch changes/swipes. The pending queue clears when switching branches.
- Responsive layout, keyboard controls, live result announcements, and reduced-motion support.

## Run locally

Use Node.js 22 or 24 and npm:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Expand **Developer chat simulator** at the bottom to run a real `beforePrompt` hook without an AI request or Chub account. The simulator is excluded from the production application.

The upstream Chub SDK declares Node 21.7.1 as its exact engine, so npm may print an engine warning on newer Node versions. This project is verified on Node 24 and its workflow uses Node 22. Do not enable `engine-strict` for this SDK.

## Use in chat

Start a line with `/roll`, or put `[[roll ...]]` inside prose:

```text
/roll d20+5
/roll d20+5 adv dc15 # Stealth
/roll d20+2 dis # Saving throw
/roll 4d6kh3 # Ability score
I strike the creature! [[roll 2d6+3 # Damage]]
```

Command order is **expression**, optional **adv/dis**, optional **dcNUMBER**, optional **# label**. Multiple commands can use separate lines. Code spans/blocks and bot replies do not execute rolls. Invalid batches produce an error without committing partial results or consuming queued panel rolls.

The visual panel's **Include in my next chat message** switch applies to new panel rolls. They are attached when you next send a normal human message; rolling alone does not send a message or trigger the AI. **Discard queue** removes pending sharing, not history. Turning the switch off does not remove already queued rolls.

Natural 1 and 20 are highlighted for a single kept, positive d20. They do not override the DC comparison or impose rules for a particular RPG. A DC passes when the total is at least the target.

Limits: 100 dice total per expression, 2–1,000 sides per die, 12 terms, modifiers up to 100,000, 10 commands per message, and 10 queued panel rolls. Pending rolls are in memory until a message is sent; reloading or changing branches discards that queue. The last 20 panel/command results are saved in the next message state. Practice results may be present in stage state but are not sent as prompt context.

## Build and install in Chub

```sh
npm run check
```

The `dist/` folder is the production stage, containing `index.html`, bundled assets, and `chub_meta.yaml`. ZIP the **contents** of `dist/` (not a containing `dist` directory). A ready-built ZIP is also supplied as `build.zip` in this workspace.

For the template's automatic Chub deployment:

1. Push this project to your own GitHub repository with default branch `main` or `master`.
2. Obtain your stage API token through Chub's API, as described in the [upstream template setup](https://github.com/CharHubAI/stage-template#quickstart). Keep it out of source files.
3. Add it under **Settings → Secrets and variables → Actions → New repository secret**, named `CHUB_AUTH_TOKEN`.
4. For an existing stage, also add the `STAGE_ID` secret. Otherwise, the workflow creates a stage and records its ID in `public/chub_meta.yaml`. Permit GitHub Actions to write repository contents for this first registration.
5. Run **Build and deploy Chub stage** from the Actions tab, or push a change. It tests, builds, creates a downloadable ZIP, and uploads to Chub when the token is configured.
6. Once uploaded, select the stage in your Chub chat's stage controls. Metadata defaults to **UNLISTED** and **ADJACENT**; edit `public/chub_meta.yaml` to change these.

Without a token the workflow still produces a downloadable build. No Chub or GitHub deployment has been performed merely by generating this project. Live installation needs your account and repository setup.

## Verification and source map

```sh
npm test             # deterministic dice and lifecycle tests
npm run lint
npm run build
npm run test:e2e     # browser tests using installed Google Chrome
```

Browser tests cover desktop/mobile, validation, dropped dice, queued results, chat commands, branch reset, and the production bundle's Chub iframe message protocol. They save screenshots to `test-results/`. Install Google Chrome, or change `channel` in `playwright.config.ts` to an installed browser before running them elsewhere.

Dependency audit: compatible updates were applied to the template. Its Chub SDK still pulls a `uuid` version with a moderate npm advisory, and development tools have remaining audit findings (including critical findings in the test worker dependency). These were not force-upgraded across major versions. Review `npm audit` before maintaining or exposing development services; development servers here bind only to loopback. This is separate from the passing functional checks.

- `src/dice.ts`: bounded parser, unbiased randomness, roll formatting, chat syntax.
- `src/Stage.tsx`: Chub hooks, queue, bounded message history, branch restore.
- `src/components/DicePanel.tsx`: visual roller and history.
- `src/index.scss`: responsive theme and animations.
- `src/TestRunner.tsx`: local development chat harness.
- `public/chub_meta.yaml`: stage metadata and configuration schema.

Font styling requests DM Sans and Manrope from Google Fonts and falls back to local sans-serif fonts if unavailable. Dice artwork is inline SVG; no image or dice API is required. The original template license is retained in `LICENSE.txt`.
