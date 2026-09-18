import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SemanticSearchDemo from "./SemanticSearchDemo";
import * as useModelModule from "../demo-kit/useModel";
import type { UseModelState } from "../demo-kit/useModel";

/** [query, doc, doc, doc] embedded in one call; row 0 is the query. */
const EMBEDDINGS = {
  data: Float32Array.from([1, 0, 0, 1, 1, 0, 0.6, 0.8]),
  dims: [4, 2],
};

function mockModel(overrides: Partial<UseModelState> = {}) {
  const state: UseModelState = {
    status: "ready",
    progress: 100,
    backend: "wasm",
    durationMs: 44,
    error: null,
    cached: true,
    probing: false,
    cacheSize: null,
    clear: vi.fn(),
    load: vi.fn(),
    run: vi.fn().mockResolvedValue(EMBEDDINGS),
    ...overrides,
  };
  vi.spyOn(useModelModule, "useModel").mockReturnValue(state);
  return state;
}

async function search(query: string) {
  await userEvent.clear(screen.getByLabelText(/Query/));
  await userEvent.type(screen.getByLabelText(/Query/), query);
  await userEvent.click(screen.getByRole("button", { name: /Search/ }));
}

describe("SemanticSearchDemo", () => {
  it("embeds the query and every document in a single run", async () => {
    const state = mockModel();
    render(<SemanticSearchDemo model="Xenova/test-model" sizeLabel="~24 MB" />);

    await userEvent.clear(screen.getByLabelText(/Documents/));
    await userEvent.type(screen.getByLabelText(/Documents/), "alpha{enter}beta{enter}gamma");
    await search("my question");

    expect(state.run).toHaveBeenCalledWith(
      [["my question", "alpha", "beta", "gamma"]],
      { pooling: "mean", normalize: true },
    );
  });

  it("lists the documents ordered by similarity to the query", async () => {
    mockModel();
    render(<SemanticSearchDemo model="Xenova/test-model" sizeLabel="~24 MB" />);

    await userEvent.clear(screen.getByLabelText(/Documents/));
    await userEvent.type(screen.getByLabelText(/Documents/), "orthogonal{enter}identical{enter}close");
    await search("my question");

    const ranked = await screen.findAllByRole("listitem");
    expect(ranked.map((item) => item.textContent)).toEqual([
      expect.stringContaining("identical"),
      expect.stringContaining("close"),
      expect.stringContaining("orthogonal"),
    ]);
  });

  it("ignores blank lines in the document list", async () => {
    const state = mockModel();
    render(<SemanticSearchDemo model="Xenova/test-model" sizeLabel="~24 MB" />);

    await userEvent.clear(screen.getByLabelText(/Documents/));
    await userEvent.type(screen.getByLabelText(/Documents/), "alpha{enter}{enter}   {enter}beta");
    await search("my question");

    expect(state.run).toHaveBeenCalledWith(
      [["my question", "alpha", "beta"]],
      expect.anything(),
    );
  });

  it("will not search on an empty query", async () => {
    const state = mockModel();
    render(<SemanticSearchDemo model="Xenova/test-model" sizeLabel="~24 MB" />);

    await userEvent.clear(screen.getByLabelText(/Query/));

    expect(screen.getByRole("button", { name: /Search/ })).toBeDisabled();
    expect(state.run).not.toHaveBeenCalled();
  });
});
