# local-ai-lab — Design

Date: 2026-09-17
Status: Approved

## Purpose

A portfolio site documenting Hugging Face models that run entirely in the
visitor's browser. No backend, no API keys, no inference costs. Each use case
gets its own page combining a working demo with a written explanation.

The site is a portfolio piece first. Its job is to show that the author can
pick a model, run it client-side, reason about where the computation happens,
and explain the result clearly.

## Scope

Version 1 ships three use cases:

1. Review sentiment analysis — `Xenova/distilbert-base-uncased-finetuned-sst-2-english`
2. Image classification — `Xenova/vit-base-patch16-224`
3. Zero-shot classification — `Xenova/nli-deberta-v3-xsmall`

Model download sizes must be verified during implementation and surfaced in
the UI before download. They are expected to be roughly 65–90 MB quantized.

These three were chosen because they exercise three different interaction
shapes: typing text, uploading a file, and supplying custom labels. This
forces the shared demo components to generalize from the start.

Adding a fourth use case must mean adding one content entry and one island
component. If it requires changing shared code, the abstraction has failed.

### Out of scope for v1

- Light mode (colors are defined as CSS tokens so it can be added later)
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

## Language

All code, comments, documentation, README, UI copy, examples, and commit
messages are written in English.

## Architecture

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
    DemoShell.tsx           # layout, status, error boundary
    ModelLoader.tsx         # download progress, cache state
    BackendBadge.tsx        # "WebGPU" | "WASM (CPU)" + timing
    CodeTabs.astro          # Python | JavaScript
  lib/
    pipeline.ts             # transformers.js singleton + worker factory
    workers/                # one worker per task type
```

Each `.mdx` file declares its model id, task, and which island to mount in
frontmatter. The body holds the description, the explanation, and the code
snippets. A single page template renders all use cases from this collection;
the three pages are not written by hand.

MDX rather than a config object because the explanations are long prose with
code interleaved, which is painful to author inside a data structure.

## Page structure

Every use case page follows the same order:

1. Interactive demo
2. Description of the use case and the model
3. Explanation of how it works
4. Code block with two tabs: `Python | JavaScript`

The code tabs are illustrative integration examples showing how to run that
model in each language. They are not a dump of the page's real source — the
real component carries worker plumbing and state management that would
obscure the point.

## Inference execution

**Workers.** All inference runs in a Web Worker, never on the main thread. On
a CPU-only machine the first inference takes long enough to freeze the page,
which on a portfolio site reads as a broken site.

**On-demand loading.** No model is downloaded on page load. An explicit
button states the size ("Load model (~65 MB)") before fetching anything.
transformers.js caches weights in IndexedDB, so repeat visits are instant.
Cache state is shown in the UI.

**Backend detection.** At startup the code checks whether WebGPU is available
and can be initialized. If so, transformers.js is configured with
`{ device: 'webgpu' }`. Otherwise it falls back to WASM on the CPU. The
fallback is mandatory: without it the demos fail outright on a large share of
browsers.

The chosen backend and the measured inference time are displayed in a badge
next to each demo. This explains latency to visitors on slower backends, and
it is portfolio content in its own right — it shows the author knows where the
computation runs.

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
