# local-ai-lab — Design

Date: 2026-09-17
Updated: 2026-09-18
Status: v1 delivered. Amended to describe what shipped, not what was planned.
Sections that changed after implementation are marked **[amended]**.

## Purpose

A portfolio site documenting Hugging Face models that run entirely in the
visitor's browser. No backend, no API keys, no inference costs. Each use case
gets its own page combining a working demo with a written explanation.

The site is a portfolio piece first. Its job is to show that the author can
pick a model, run it client-side, reason about where the computation happens,
and explain the result clearly.

## Scope

Version 1 shipped three use cases:

1. Review sentiment analysis — `Xenova/distilbert-base-uncased-finetuned-sst-2-english`
2. Image classification — `Xenova/vit-base-patch16-224`
3. Zero-shot classification — `Xenova/nli-deberta-v3-xsmall`

Model download sizes are verified against the real weights and surfaced in
the UI before anything is fetched. They land at ~67 MB, ~88 MB and ~87 MB
quantized. Any fourth use case must have its size verified the same way; the
figure shown on the button is a promise about the visitor's bandwidth.

These three were chosen because they exercise three different interaction
shapes: typing text, uploading a file, and supplying custom labels. This
forces the shared demo components to generalize from the start.

### Beyond v1

**Semantic search** — `Xenova/all-MiniLM-L6-v2`, ~24 MB, shipped. The first
experiment whose output is a *ranking of a corpus* rather than a score for one
input, and the smallest model on the site by a factor of three.

**Object detection** — `Xenova/detr-resnet-50`, ~43 MB, shipped. The first
output that is *drawn* rather than listed: boxes positioned over the photo in
CSS percentages, which track the image through every viewport with no redraw.
It is also where download size and inference cost visibly come apart — half
the classifier's weights, roughly five times its latency on WASM.

Planned next: **handwriting OCR** (`Xenova/trocr-small-handwritten`, ~68 MB)
for generated text produced token by token. Six is the intended total: past
that, an addition is another model rather than another claim.

Speech recognition was considered and dropped. `whisper-tiny.en` is
English-only and would mistranscribe the author's own spoken Spanish in front
of the audience this site is for; it also needs a microphone permission prompt
on a site whose argument is that nothing leaves the tab.

Adding a fourth use case should mean adding one content entry and one island
component. That held for the three shipped in v1.

**[amended]** It will not hold for every direction. Audio input (decoding to
16 kHz mono before inference), streamed token-by-token output, and drawing
onto a canvas instead of rendering bars are capabilities the kit genuinely
does not have. Adding one of those means extending shared code on purpose —
which is a decision to take before starting, not a failure to discover
halfway through.

### Out of scope

**[amended]** Light mode was dropped as a goal, not deferred. The site is
designed as one black instrument panel; a second palette would be a second
design to maintain for no one who asked. Colors remain CSS custom properties
because that is how a design system is expressed, not because a light theme
is coming.

- Light mode, and any theme toggle
- Search, comments, blog, RSS
- Serving model weights from our own origin
- Any server-side code

## Stack

- **Astro** in `output: 'static'` mode, with React islands via `astro add react`
- **Base theme:** Astro Nano (MIT, Tailwind, monospace, dark-first). Taken as a
  starting point, not as a maintained dependency — Astro is upgraded to current
  on day one, and unused theme features are removed.
- **Inference:** `@huggingface/transformers` (transformers.js v3)
- **Hosting:** Vercel, static output, no adapter

Astro was chosen because the site is mostly static prose with a few heavy
interactive islands, which is precisely Astro's use case. Pages ship almost no
JavaScript until the visitor opts into loading a model.

## Tooling

Bun is the package manager and script runner: `bun install`, `bun add`,
`bun add -d`, `bunx`, `bun run <script>`. npm, npx, and yarn are not used, and
the committed lockfile is `bun.lock`.

The test suite is run with `bun run test`, not `bun test` — the latter invokes
Bun's own runner, which ignores `vitest.config.ts`.

## Language

All code, comments, documentation, README, UI copy, examples, and commit
messages are written in English.

## Architecture

**[amended]** — the shipped tree:

```
src/
  content/demos/            # one .mdx per use case
    sentiment-analysis.mdx
    image-classification.mdx
    zero-shot-classification.mdx
  components/demos/         # one React island per use case
    SentimentDemo.tsx
    ImageClassificationDemo.tsx
    ZeroShotDemo.tsx
  components/demo-kit/      # shared building blocks
    DemoShell.tsx           # the instrument panel: status, errors, framing
    ModelLoader.tsx         # the download action, the meter, the status line
    ClearModelButton.tsx    # hand one model's weights back
    DeviceCache.tsx         # what this browser holds, across all models
    BackendBadge.tsx        # "WebGPU" | "WASM (CPU)" + timing
    ConfidenceBar.tsx       # one scored label
    CodeTabs.astro          # Python | JavaScript, highlighted at build time
  lib/
    inference-client.ts     # transport-agnostic worker client
    backend.ts              # WebGPU detection with WASM fallback
    model-cache.ts          # read and clear the weights on this device
    workers/inference.worker.ts
```

There is one worker for every task, not one per task type: the pipeline is a
runtime argument, so a new use case needs no new worker.

Each `.mdx` file declares its model id, task, size label and category in
frontmatter. The body holds the description, the explanation, and the code
snippets. A single page template renders all use cases from this collection;
the three pages are not written by hand.

MDX rather than a config object because the explanations are long prose with
code interleaved, which is painful to author inside a data structure.

## Page structure

**[amended]** Every use case page follows the same order:

1. Breadcrumb, title, and a spec strip of the model's own figures
2. Interactive demo
3. Code block with two tabs: `Python | JavaScript`
4. Description of the use case and the model
5. Explanation of how it works

The snippets moved directly under the demo. A reader who has just watched the
model run wants to know how to call it before they want the prose, and the
code is the thing they came to copy.

The code tabs are illustrative integration examples showing how to run that
model in each language. They are not a dump of the page's real source — the
real component carries worker plumbing and state management that would
obscure the point.

## Inference execution

**Workers.** All inference runs in a Web Worker, never on the main thread. On
a CPU-only machine the first inference takes long enough to freeze the page,
which on a portfolio site reads as a broken site.

**On-demand loading.** No model is downloaded on page load. An explicit
button states the size ("Download model (~67 MB)") before fetching anything.

**[amended] Cache-aware loading.** transformers.js keeps weights in **Cache
Storage** (the bucket named `transformers-cache`), not IndexedDB, as the
earlier draft of this document claimed. Every demo reads that cache on mount:

- weights already present → the model is brought up on its own, with no gate.
  Nothing crosses the network, so there is nothing left to consent to, and the
  visitor is not asked to "download" something they already have.
- weights absent → the download button, with the size stated.

The consent rule is about bandwidth, not about ceremony. Applying it to a
cached model was the bug, not the fix.

**Reversible.** Anything a page put on the device can be taken back off it:
per model from the demo panel, or all at once from the index pages, with the
size measured off the cache rather than estimated.

**Backend detection.** At startup the code checks whether WebGPU is available
and can be initialized. If so, transformers.js is configured with
`{ device: 'webgpu' }`. Otherwise it falls back to WASM on the CPU. The
fallback is mandatory: without it the demos fail outright on a large share of
browsers.

The chosen backend and the measured inference time are displayed in a badge
next to each demo. This explains latency to visitors on slower backends, and
it is portfolio content in its own right — it shows the author knows where the
computation runs.

## Worker protocol

**[amended]** A run message carries `args`, the pipeline's positional
arguments in transformers.js order, plus an optional trailing options object.

This is not incidental. transformers.js takes several pipeline inputs
positionally — zero-shot classification receives its candidate labels as the
second argument — and an earlier protocol that could only send
`task(input, options)` had no way to express that. Passing the labels inside
the options object silently produced a confident, meaningless ranking.

**Results are reduced before they are posted.** The embedding pipelines return
a transformers.js `Tensor`, which carries private fields and is rejected
outright by structured clone. The worker hands over `{ type, data, dims }`
instead; everything else passes through untouched.

This was the first shared-code change a new use case forced, exactly as this
document warned it would be — and the cheapest possible version of it.

## Visual design

**[amended]** The site reads as a lab notebook rather than a product page:
hairline rules instead of boxes, a three-column shell (navigation, content,
metadata), and a monospace voice reserved for every machine-written value —
sizes, labels, scores, runtime status. Space Grotesk over JetBrains Mono, on
black.

The demo sits inside a double-ruled frame that reads as a piece of equipment.
Before the weights arrive its inputs stay on screen, visible but inert inside
a disabled fieldset, so a visitor can see what the instrument does before
committing to the download.

Probability bars take a single hue stepped by rank. They encode magnitude, so
they are not a categorical palette; identity stays with the label beside the
bar, and the figures wear text tokens rather than the series color.

## Per-demo notes

**Review sentiment.** Textarea pre-populated with sample reviews.
Positive/negative result with a confidence score.

**Image classification.** Drag-and-drop or file picker, plus three or four
sample images so visitors do not have to go find a photo. Top-5 predictions
with confidence bars.

**Zero-shot classification.** The visitor supplies both the text and the
candidate labels, with no retraining. The explanation should emphasize this,
since it is the least widely understood capability of the three.

## Deployment

Static Astro output deployed to Vercel. No adapter, no serverless functions,
nothing that can fail at runtime or incur cost.

A `vercel.json` sets the `Cross-Origin-Opener-Policy` and
`Cross-Origin-Embedder-Policy` headers required for multi-threaded WASM.
Without them WASM runs single-threaded, which penalizes exactly the machines
that lack WebGPU.

Model weights are fetched from the Hugging Face CDN rather than served from
our own origin, keeping the repository small and bandwidth usage off Vercel.
