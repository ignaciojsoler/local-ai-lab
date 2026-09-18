import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SpeechDemo from "./SpeechDemo";
import * as useModelModule from "../demo-kit/useModel";
import * as audio from "../../lib/audio";
import type { UseModelState } from "../demo-kit/useModel";

function streamingRun(chunks: string[], final: string): UseModelState["run"] {
  return vi.fn(
    async (_args: unknown[], _options?: unknown, onPartial?: (text: string) => void) => {
      for (const chunk of chunks) onPartial?.(chunk);
      return { text: final };
    },
  ) as unknown as UseModelState["run"];
}

function mockModel(overrides: Partial<UseModelState> = {}) {
  vi.spyOn(audio, "decodeAudio").mockResolvedValue(Float32Array.from([0, 0.5, -0.5]));
  vi.stubGlobal("fetch", vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })));

  const state: UseModelState = {
    status: "ready",
    progress: 100,
    backend: "wasm",
    durationMs: 1400,
    error: null,
    cached: true,
    probing: false,
    cacheSize: null,
    clear: vi.fn(),
    load: vi.fn(),
    run: streamingRun([" And so", " my fellow", " Americans."], "And so my fellow Americans."),
    ...overrides,
  };
  vi.spyOn(useModelModule, "useModel").mockReturnValue(state);
  return state;
}

describe("SpeechDemo", () => {
  it("writes the transcript as the decoder produces it", async () => {
    mockModel();
    render(<SpeechDemo model="Xenova/test-model" sizeLabel="~45 MB" />);

    await waitFor(() =>
      expect(screen.getByTestId("transcript")).toHaveTextContent("And so my fellow Americans."),
    );
  });

  it("hands the model decoded samples, not a URL", async () => {
    const state = mockModel();
    render(<SpeechDemo model="Xenova/test-model" sizeLabel="~45 MB" />);

    // Whisper takes raw mono samples at 16 kHz; passing the file's address
    // would leave the pipeline to guess at decoding and resampling.
    await waitFor(() => expect(state.run).toHaveBeenCalled());
    expect(state.run).toHaveBeenCalledWith(
      [expect.any(Float32Array)],
      expect.anything(),
      expect.any(Function),
    );
  });

  it("clears the previous transcript before starting another run", async () => {
    const state = mockModel();
    render(<SpeechDemo model="Xenova/test-model" sizeLabel="~45 MB" />);
    await waitFor(() => expect(screen.getByTestId("transcript")).not.toBeEmptyDOMElement());

    state.run = streamingRun(["Something else."], "Something else.");
    const [firstChip] = document.querySelectorAll<HTMLButtonElement>(".chip");
    await userEvent.click(firstChip);

    await waitFor(() =>
      expect(screen.getByTestId("transcript")).toHaveTextContent("Something else."),
    );
    expect(screen.getByTestId("transcript")).not.toHaveTextContent("Americans");
  });

  it("ignores a run that finishes after a newer one has started", async () => {
    // Clicking a second clip while the first is still decoding used to leave
    // the late result prepended to the new one: one transcript made of two.
    let settleFirst: (value: unknown) => void = () => {};
    const slow = vi.fn(
      (_a: unknown[], _o?: unknown, onPartial?: (t: string) => void) =>
        new Promise((resolve) => {
          settleFirst = () => {
            onPartial?.("stale words");
            resolve({ text: "stale words" });
          };
        }),
    ) as unknown as UseModelState["run"];

    const state = mockModel({ run: slow });
    render(<SpeechDemo model="Xenova/test-model" sizeLabel="~80 MB" />);
    await waitFor(() => expect(state.run).toHaveBeenCalled());

    state.run = streamingRun(["fresh words"], "fresh words");
    const [, secondChip] = document.querySelectorAll<HTMLButtonElement>(".chip");
    await userEvent.click(secondChip);
    await waitFor(() => expect(screen.getByTestId("transcript")).toHaveTextContent("fresh"));

    settleFirst(null);

    await waitFor(() => expect(screen.getByTestId("transcript")).toHaveTextContent("fresh words"));
    expect(screen.getByTestId("transcript")).not.toHaveTextContent("stale");
  });

  it("shows a meter until the first words arrive", async () => {
    // The encoder runs before a single token exists. Without this the panel
    // sits on a blinking caret for seconds and looks stalled.
    mockModel({
      status: "running",
      run: vi.fn(() => new Promise(() => {})) as unknown as UseModelState["run"],
    });
    render(<SpeechDemo model="Xenova/test-model" sizeLabel="~80 MB" />);

    expect(await screen.findByRole("progressbar", { name: /Running/ })).toBeInTheDocument();
    expect(screen.getByText(/Decoding the audio/)).toBeInTheDocument();
  });

  it("reports a clip it could not decode instead of transcribing silence", async () => {
    mockModel();
    vi.spyOn(audio, "decodeAudio").mockRejectedValue(new Error("Unable to decode audio data"));
    render(<SpeechDemo model="Xenova/test-model" sizeLabel="~45 MB" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be decoded/i);
  });
});
