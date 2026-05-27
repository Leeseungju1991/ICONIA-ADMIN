import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProfileRail } from "./ProfileRail";

afterEach(cleanup);

describe("ProfileRail", () => {
  it("renders operator name and weekly bars", () => {
    render(<ProfileRail
      operatorEmail="me@iconia.example"
      weekly={[1,2,3,4,5,6,7].map((c,i)=>({ date: `2026-05-${20+i}`, count: c }))}
      collaborators={[{ email: "a@x", actions: 5 }, { email: "b@x", actions: 3 }]}
    />);
    expect(screen.getByText(/me@iconia.example/)).toBeTruthy();
    expect(screen.getByText("a@x")).toBeTruthy();
    expect(screen.getByText("b@x")).toBeTruthy();
  });
});
