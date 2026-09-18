import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ImageClassificationDemo from "./ImageClassificationDemo";
import * as useModelModule from "../demo-kit/useModel";
import type { UseModelState } from "../demo-kit/useModel";

function mockModel(overrides: Partial<UseModelState> = {}) {
  const state: UseModelState = {
    status: "ready",
    progress: 100,
    backend: "webgpu",
    durationMs: 48,
    error: null,
    cached: true,
    probing: false,
    cacheSize: null,
    clear: vi.fn(),
    load: vi.fn(),
    run: vi.fn().mockResolvedValue([
      { label: "golden retriever", score: 0.81 },
      { label: "Labrador retriever", score: 0.12 },
    ]),
    ...overrides,
  };
  vi.spyOn(useModelModule, "useModel").mockReturnValue(state);
  return state;
}

describe("ImageClassificationDemo", () => {
  it("classifies a sample image and lists the top predictions", async () => {
    const state = mockModel();
    render(<ImageClassificationDemo model="Xenova/test-model" sizeLabel="~88 MB" />);

    await userEvent.click(screen.getAllByRole("button", { name: /\.jpg$/ })[0]);

    expect(state.run).toHaveBeenCalled();
    expect(await screen.findByText("golden retriever")).toBeInTheDocument();
    expect(screen.getByText("Labrador retriever")).toBeInTheDocument();
  });

  it("classifies an uploaded file", async () => {
    const state = mockModel();
    render(<ImageClassificationDemo model="Xenova/test-model" sizeLabel="~88 MB" />);

    const file = new File(["binary"], "photo.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText(/Upload image/), file);

    expect(state.run).toHaveBeenCalled();
    expect(await screen.findByText("golden retriever")).toBeInTheDocument();
  });

  it("requests the top five predictions", async () => {
    const state = mockModel();
    render(<ImageClassificationDemo model="Xenova/test-model" sizeLabel="~88 MB" />);

    await userEvent.click(screen.getAllByRole("button", { name: /\.jpg$/ })[0]);

    expect(state.run).toHaveBeenCalledWith([expect.any(String)], { top_k: 5 });
  });
});
