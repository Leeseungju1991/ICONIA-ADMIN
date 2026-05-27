import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { UserTimeline } from "./UserTimeline";
import { mockUser360Timeline } from "@/lib/mockUser360";

afterEach(cleanup);

describe("UserTimeline", () => {
  it("renders empty notice when events array is empty", () => {
    render(<UserTimeline events={[]} />);
    expect(screen.getByText("이벤트 없음")).toBeTruthy();
  });

  it("renders each event title when events are present", () => {
    const events = mockUser360Timeline("u@x");
    render(<UserTimeline events={events} />);
    for (const e of events) {
      expect(screen.getAllByText(e.title).length).toBeGreaterThan(0);
    }
  });
});
