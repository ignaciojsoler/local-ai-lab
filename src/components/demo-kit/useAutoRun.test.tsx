import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAutoRun } from "./useAutoRun";
import type { ModelStatus } from "./useModel";

function render(run: () => void, status: ModelStatus = "idle") {
  return renderHook(({ status }: { status: ModelStatus }) => useAutoRun(status, run), {
    initialProps: { status },
  });
}

describe("useAutoRun", () => {
  it("waits while the model is not ready", () => {
    const run = vi.fn();
    render(run, "loading");

    expect(run).not.toHaveBeenCalled();
  });

  it("runs the default case as soon as the model is ready", async () => {
    const run = vi.fn();
    const { rerender } = render(run);

    rerender({ status: "ready" });

    await waitFor(() => expect(run).toHaveBeenCalledOnce());
  });

  it("does not run again when an inference of its own finishes", async () => {
    const run = vi.fn();
    const { rerender } = render(run);

    rerender({ status: "ready" });
    await waitFor(() => expect(run).toHaveBeenCalledOnce());

    // A run moves the model through running -> ready. Treating that arrival
    // as "ready again" would start an inference loop.
    rerender({ status: "running" });
    rerender({ status: "ready" });

    expect(run).toHaveBeenCalledOnce();
  });

  it("runs again after the weights are cleared and loaded once more", async () => {
    const run = vi.fn();
    const { rerender } = render(run);

    rerender({ status: "ready" });
    await waitFor(() => expect(run).toHaveBeenCalledOnce());

    rerender({ status: "idle" });
    rerender({ status: "loading" });
    rerender({ status: "ready" });

    await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
  });
});
