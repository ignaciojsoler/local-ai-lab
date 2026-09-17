import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SentimentDemo from "./SentimentDemo";
import * as useModelModule from "../demo-kit/useModel";
import type { UseModelState } from "../demo-kit/useModel";

function mockModel(overrides: Partial<UseModelState> = {}) {
  const state: UseModelState = {
    status: "ready",
    progress: 100,
    backend: "wasm",
    durationMs: 31,
    error: null,
    load: vi.fn(),
    run: vi.fn().mockResolvedValue([{ label: "POSITIVE", score: 0.9812 }]),
    ...overrides,
  };
  vi.spyOn(useModelModule, "useModel").mockReturnValue(state);
  return state;
}

describe("SentimentDemo", () => {
  it("renders the classified label and score after analyzing", async () => {
    const state = mockModel();
    render(<SentimentDemo model="Xenova/test-model" sizeLabel="~67 MB" />);

    await userEvent.clear(screen.getByRole("textbox"));
    await userEvent.type(screen.getByRole("textbox"), "Loved it");
    await userEvent.click(screen.getByRole("button", { name: /Analyze/ }));

    expect(state.run).toHaveBeenCalledWith("Loved it");
    expect(await screen.findByText("POSITIVE")).toBeInTheDocument();
    expect(screen.getByText("98.1%")).toBeInTheDocument();
  });

  it("fills the textarea when a sample review is picked", async () => {
    mockModel();
    render(<SentimentDemo model="Xenova/test-model" sizeLabel="~67 MB" />);

    const sample = screen.getAllByRole("button", { name: /^Sample/ })[0];
    await userEvent.click(sample);

    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).not.toBe("");
  });

  it("disables the analyze button on empty input", async () => {
    mockModel();
    render(<SentimentDemo model="Xenova/test-model" sizeLabel="~67 MB" />);

    await userEvent.clear(screen.getByRole("textbox"));

    expect(screen.getByRole("button", { name: /Analyze/ })).toBeDisabled();
  });
});
