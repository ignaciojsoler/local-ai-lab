# Local AI Lab

A portfolio of Hugging Face models running entirely in your browser. No backend, no API keys, no data leaving your device: every demo downloads a model straight from the Hugging Face CDN and runs inference on your own machine, using WebGPU when it's available and falling back to WASM when it's not.

## Stack

- [Astro](https://astro.build) (static output, no adapter)
- [React](https://react.dev) for the interactive demo islands
- [Tailwind CSS](https://tailwindcss.com) for styling
- [`@huggingface/transformers`](https://huggingface.co/docs/transformers.js) (Transformers.js) for in-browser inference, run inside a Web Worker
- [Vitest](https://vitest.dev) + Testing Library for tests
- Deployed as a static site on [Vercel](https://vercel.com)

## Running locally

This project uses [Bun](https://bun.sh) as the package manager and script runner. Do not use npm, npx, or yarn.

```bash
bun install
bun run dev
```

Run the test suite:

```bash
bun run test
```

> **Note:** `bun run test` is not the same as `bun test`. `bun test` invokes Bun's own built-in test runner, which does not know about this project's Vitest configuration. Always use `bun run test`.

Build for production and preview the static output:

```bash
bun run build
bun run preview
```

## Architecture

Each demo is a React "island" hydrated on the client (`client:visible`) that talks to a dedicated Web Worker. The worker owns the `@huggingface/transformers` pipeline: it loads the requested model on demand — only when the demo actually runs, not on page load — reports download progress back to the UI, and runs inference off the main thread so the page never freezes. The pipeline prefers the WebGPU execution provider and transparently falls back to WASM on devices or browsers that don't support it. Because model weights and multi-threaded WASM both rely on cross-origin isolation, `vercel.json` sets the `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers on every route (see below).

## Adding a new demo

1. Add an MDX entry to `src/content/demos/`, with frontmatter (`title`, `summary`, `task`, `model`, `sizeLabel`, `order`) matching the existing entries, and import/render your demo component inside it.
2. Build one island component under `src/components/demos/` (a `.tsx` file) that uses the shared demo-kit worker/UI helpers, following the pattern of `SentimentDemo.tsx`, `ImageClassificationDemo.tsx`, or `ZeroShotDemo.tsx`.

The demo automatically shows up on `/demos` and on the home page, both of which list the `demos` content collection sorted by `order`.

## Deployment

The site builds to static HTML/JS/CSS (`output: "static"` in `astro.config.mjs`, no adapter) and is deployed on Vercel. `vercel.json` sets:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "credentialless" }
      ]
    }
  ]
}
```

These cross-origin isolation headers are required for multi-threaded WASM. Without them, the WASM fallback path runs single-threaded, which mainly penalizes the visitors whose machines lack WebGPU. `credentialless` is used instead of `require-corp` because model weights are fetched cross-origin from the Hugging Face CDN, which does not send `Cross-Origin-Resource-Policy` headers — under `require-corp` those fetches would be blocked and every demo would fail to load its model.

After deploying, verify isolation actually took effect by opening the deployed site's browser console and evaluating `crossOriginIsolated` — it should print `true`.
