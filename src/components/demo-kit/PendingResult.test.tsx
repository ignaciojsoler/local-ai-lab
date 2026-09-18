import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PendingResult } from "./PendingResult";

describe("PendingResult", () => {
  it("says the model has not run yet when it is idle", () => {
    render(<PendingResult running={false} />);

    expect(screen.getByText(/No run yet/)).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows work in progress while the model is running", () => {
    // Detection takes seconds on a CPU. Leaving "no run yet" on screen for
    // that long reads as a demo that ignored the click.
    render(<PendingResult running label="Scanning the image" />);

    expect(screen.getByRole("progressbar", { name: /Running/ })).toBeInTheDocument();
    expect(screen.getByText(/Scanning the image/)).toBeInTheDocument();
    expect(screen.queryByText(/No run yet/)).not.toBeInTheDocument();
  });
});
