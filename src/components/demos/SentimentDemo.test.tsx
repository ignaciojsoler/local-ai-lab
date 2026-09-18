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
    cached: true,
    probing: false,
    cacheSize: null,
    clear: vi.fn(),
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

    expect(state.run).toHaveBeenCalledWith(["Loved it"]);
    expect(await screen.findByText("POSITIVE")).toBeInTheDocument();
    expect(screen.getByText("0.98")).toBeInTheDocument();
  });

  it("names each sample after what it demonstrates", async () => {
    mockModel();
    render(<SentimentDemo model="Xenova/test-model" sizeLabel="~67 MB" />);

    // The chip says what the review is, not where it sits in the list.
    expect(screen.getByRole("button", { name: "glowing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "great_service" })).toBeInTheDocument();
  });

  it("fills the textarea with the sample that was picked", async () => {
    mockModel();
    render(<SentimentDemo model="Xenova/test-model" sizeLabel="~67 MB" />);

    await userEvent.click(screen.getByRole("button", { name: "fly_in_soup" }));

    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toMatch(
      /fly in my soup/,
    );
  });

  it("disables the analyze button on empty input", async () => {
    mockModel();
    render(<SentimentDemo model="Xenova/test-model" sizeLabel="~67 MB" />);

    await userEvent.clear(screen.getByRole("textbox"));

    expect(screen.getByRole("button", { name: /Analyze/ })).toBeDisabled();
  });
});
