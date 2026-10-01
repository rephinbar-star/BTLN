import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelpMeChoose } from "./HelpMeChoose";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

const open = () => {
  render(<MemoryRouter><HelpMeChoose /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Help me choose" }));
};

describe("Help Me Choose recommendations", () => {
  it.each([
    [["A message and how to reply", "Just this one exchange"], "/examples/quick"],
    [["Patterns between two people", "Just this one conversation"], "/examples/deep"],
    [["Our group chat", "A funny roast"], "/examples/group-roast"],
    [["Our group chat", "A deeper read"], "/examples/group"],
    [["Patterns between two people", "I'll be reading regularly", "Mostly reports of conversations"], "/examples/deep"],
  ])("links the %j branch to %s", (answers, expected) => {
    open();
    answers.forEach((answer) => fireEvent.click(screen.getByRole("button", { name: answer })));
    expect(screen.getByRole("link", { name: "See Example" })).toHaveAttribute("href", expected);
  });

  it("identifies unavailable Interactive Mode before its proposed price", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "A message and how to reply" }));
    fireEvent.click(screen.getByRole("button", { name: /Help as it continues/ }));
    expect(screen.getByText(/In development — not available to buy/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See Quick Take example" })).toHaveAttribute("href", "/examples/quick");
  });

  it("labels Prime as a fictional unavailable preview on both paths", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "My patterns across relationships over time" }));
    expect(screen.getByText(/In development — not available to buy/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /fictional Relationship360 preview/ })).toHaveAttribute("href", "/examples/relationship360");
  });
});