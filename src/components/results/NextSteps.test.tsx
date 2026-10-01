import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NextSteps } from "./NextSteps";

vi.mock("@/components/prime/PrimeOffer", () => ({ PrimeOffer: () => <div>Prime offer</div> }));

describe("Quick Take next steps", () => {
  it("has one repeat route and contextual Deep Read link", () => {
    render(<MemoryRouter><NextSteps mode="quick" /></MemoryRouter>);
    expect(screen.getAllByRole("heading", { name: "What next?" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Read another text/ })).toHaveAttribute("href", "/quick");
    expect(screen.getByRole("link", { name: /same thing keep happening/ })).toHaveAttribute("href", "/deep");
  });

  it("does not upsell when safety is the priority", () => {
    render(<MemoryRouter><NextSteps mode="quick" safety /></MemoryRouter>);
    expect(screen.queryByRole("link", { name: /same thing keep happening/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Prime offer")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Read another text/ })).toHaveAttribute("href", "/quick");
  });
});