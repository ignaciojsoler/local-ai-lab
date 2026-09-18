import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeviceCache } from "./DeviceCache";
import * as cache from "../../lib/model-cache";

const MODELS = ["Xenova/a", "Xenova/b", "Xenova/c"];

afterEach(() => vi.restoreAllMocks());

describe("DeviceCache", () => {
  it("reports an empty cache without offering to clear it", async () => {
    vi.spyOn(cache, "cachedModelSize").mockResolvedValue(null);

    render(<DeviceCache models={MODELS} />);

    expect(await screen.findByText("Nothing cached yet")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("counts only the models actually on the device and sums their size", async () => {
    vi.spyOn(cache, "cachedModelSize").mockImplementation(async (model) =>
      model === "Xenova/c" ? null : 32_000_000,
    );

    render(<DeviceCache models={MODELS} />);

    expect(await screen.findByText("2 of 3 · 64 MB")).toBeInTheDocument();
  });

  it("clears every model once the offer is confirmed, then re-measures", async () => {
    const size = vi.spyOn(cache, "cachedModelSize").mockResolvedValue(32_000_000);
    const clear = vi.spyOn(cache, "clearModelCache").mockResolvedValue(1);

    render(<DeviceCache models={MODELS} />);
    await screen.findByText("3 of 3 · 96 MB");

    await userEvent.click(screen.getByRole("button", { name: /Free the space/ }));
    expect(clear).not.toHaveBeenCalled();

    size.mockResolvedValue(null);
    await userEvent.click(screen.getByRole("button", { name: /Clear all/ }));

    await waitFor(() => expect(clear).toHaveBeenCalledTimes(MODELS.length));
    expect(await screen.findByText("Nothing cached yet")).toBeInTheDocument();
  });
});
