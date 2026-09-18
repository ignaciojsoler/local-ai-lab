import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ZeroShotDemo from "./ZeroShotDemo";
import * as useModelModule from "../demo-kit/useModel";
import type { UseModelState } from "../demo-kit/useModel";

function mockModel(overrides: Partial<UseModelState> = {}) {
  const state: UseModelState = {
    status: "ready",
    progress: 100,
    backend: "wasm",
    durationMs: 210,
    error: null,
    cached: true,
    probing: false,
    cacheSize: null,
    clear: vi.fn(),
    load: vi.fn(),
    run: vi.fn().mockResolvedValue({
      sequence: "My package never arrived",
      labels: ["shipping", "billing", "product quality"],
      scores: [0.88, 0.07, 0.05],
    }),
    ...overrides,
  };
  vi.spyOn(useModelModule, "useModel").mockReturnValue(state);
  return state;
}

describe("ZeroShotDemo", () => {
  it("passes the text and the parsed labels to the model", async () => {
    const state = mockModel();
    render(<ZeroShotDemo model="Xenova/test-model" sizeLabel="~70 MB" />);

    await userEvent.clear(screen.getByLabelText(/Text to classify/));
    await userEvent.type(screen.getByLabelText(/Text to classify/), "My package never arrived");
    await userEvent.clear(screen.getByLabelText(/Candidate labels/));
    await userEvent.type(screen.getByLabelText(/Candidate labels/), "shipping, billing");
    await userEvent.click(screen.getByRole("button", { name: /Classify/ }));

    // The candidate labels are a positional argument of the transformers.js
    // pipeline; handing them over in the options object instead classified
    // every text against a single "[object Object]" label.
    expect(state.run).toHaveBeenCalledWith([
      "My package never arrived",
      ["shipping", "billing"],
    ]);
  });

  it("renders each label with its score", async () => {
    mockModel();
    render(<ZeroShotDemo model="Xenova/test-model" sizeLabel="~70 MB" />);

    await userEvent.click(screen.getByRole("button", { name: /Classify/ }));

    expect(await screen.findByText("shipping")).toBeInTheDocument();
    expect(screen.getByText("0.88")).toBeInTheDocument();
    expect(screen.getByText("product quality")).toBeInTheDocument();
  });

  it("disables classify until at least two labels are given", async () => {
    mockModel();
    render(<ZeroShotDemo model="Xenova/test-model" sizeLabel="~70 MB" />);

    await userEvent.clear(screen.getByLabelText(/Candidate labels/));
    await userEvent.type(screen.getByLabelText(/Candidate labels/), "shipping");

    expect(screen.getByRole("button", { name: /Classify/ })).toBeDisabled();
  });
});
