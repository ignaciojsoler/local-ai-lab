import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ObjectDetectionDemo from "./ObjectDetectionDemo";
import * as useModelModule from "../demo-kit/useModel";
import type { UseModelState } from "../demo-kit/useModel";

const DETECTIONS = [
  { label: "dog", score: 0.994, box: { xmin: 0.1, ymin: 0.2, xmax: 0.5, ymax: 0.9 } },
  { label: "frisbee", score: 0.612, box: { xmin: 0.6, ymin: 0.1, xmax: 0.7, ymax: 0.2 } },
];

function mockModel(overrides: Partial<UseModelState> = {}) {
  const state: UseModelState = {
    status: "ready",
    progress: 100,
    backend: "wasm",
    durationMs: 310,
    error: null,
    cached: true,
    probing: false,
    cacheSize: null,
    clear: vi.fn(),
    load: vi.fn(),
    run: vi.fn().mockResolvedValue(DETECTIONS),
    ...overrides,
  };
  vi.spyOn(useModelModule, "useModel").mockReturnValue(state);
  return state;
}

describe("ObjectDetectionDemo", () => {
  it("asks for boxes in percentages so the overlay can be laid out in CSS", async () => {
    const state = mockModel();
    render(<ObjectDetectionDemo model="Xenova/test-model" sizeLabel="~43 MB" />);

    await userEvent.click(screen.getAllByRole("button", { name: /\.jpg$/ })[0]);

    expect(state.run).toHaveBeenCalledWith([expect.any(String)], {
      threshold: 0.5,
      percentage: true,
    });
  });

  it("draws one labelled box per detection, positioned over the image", async () => {
    mockModel();
    render(<ObjectDetectionDemo model="Xenova/test-model" sizeLabel="~43 MB" />);

    await userEvent.click(screen.getAllByRole("button", { name: /\.jpg$/ })[0]);

    const boxes = await screen.findAllByTestId("detection-box");
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toHaveStyle({ left: "10%", top: "20%", width: "40%", height: "70%" });
    expect(boxes[0]).toHaveTextContent("dog");
  });

  it("counts what it found, so an empty result is legible as a result", async () => {
    mockModel({ run: vi.fn().mockResolvedValue([]) });
    render(<ObjectDetectionDemo model="Xenova/test-model" sizeLabel="~43 MB" />);

    await userEvent.click(screen.getAllByRole("button", { name: /\.jpg$/ })[0]);

    expect(await screen.findByText(/Nothing above the threshold/)).toBeInTheDocument();
  });
});
