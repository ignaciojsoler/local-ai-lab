import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TranslationDemo from "./TranslationDemo";
import * as useModelModule from "../demo-kit/useModel";
import type { UseModelState } from "../demo-kit/useModel";

/** Stands in for the worker: emits chunks, then resolves with the whole text. */
function streamingRun(chunks: string[], final: string): UseModelState["run"] {
  return vi.fn(
    async (_args: unknown[], _options?: unknown, onPartial?: (text: string) => void) => {
      for (const chunk of chunks) onPartial?.(chunk);
      return [{ translation_text: final }];
    },
  ) as unknown as UseModelState["run"];
}

function mockModel(overrides: Partial<UseModelState> = {}) {
  const state: UseModelState = {
    status: "ready",
    progress: 100,
    backend: "wasm",
    durationMs: 800,
    error: null,
    cached: true,
    probing: false,
    cacheSize: null,
    clear: vi.fn(),
    load: vi.fn(),
    run: streamingRun(["El gato ", "duerme ", "en el sofá."], "El gato duerme en el sofá."),
    ...overrides,
  };
  vi.spyOn(useModelModule, "useModel").mockReturnValue(state);
  return state;
}

describe("TranslationDemo", () => {
  it("writes the translation as the decoder produces it", async () => {
    mockModel();
    render(<TranslationDemo model="Xenova/test-model" sizeLabel="~121 MB" />);

    await waitFor(() =>
      expect(screen.getByTestId("translation")).toHaveTextContent("El gato duerme en el sofá."),
    );
  });

  it("subscribes to the stream rather than waiting for the whole result", async () => {
    const state = mockModel();
    render(<TranslationDemo model="Xenova/test-model" sizeLabel="~121 MB" />);

    await waitFor(() => expect(state.run).toHaveBeenCalled());
    expect(state.run).toHaveBeenCalledWith(
      [expect.any(String)],
      undefined,
      expect.any(Function),
    );
  });

  it("drops the previous translation before starting a new one", async () => {
    const state = mockModel();
    render(<TranslationDemo model="Xenova/test-model" sizeLabel="~121 MB" />);
    await waitFor(() => expect(screen.getByTestId("translation")).not.toBeEmptyDOMElement());

    state.run = streamingRun(["Otra frase."], "Otra frase.");
    await userEvent.click(screen.getAllByRole("button", { name: /^[a-z_]+$/ })[1]);

    await waitFor(() => expect(screen.getByTestId("translation")).toHaveTextContent("Otra frase."));
    expect(screen.getByTestId("translation")).not.toHaveTextContent("gato");
  });

  it("will not translate an empty box", async () => {
    mockModel();
    render(<TranslationDemo model="Xenova/test-model" sizeLabel="~121 MB" />);

    await userEvent.clear(screen.getByLabelText(/English/));

    expect(screen.getByRole("button", { name: /Translate/ })).toBeDisabled();
  });
});
