import { render, screen } from "@testing-library/react";
import { EmptyState, ErrorState } from "@/components/common/state-panel";
import { LoadingState } from "@/components/common/loading-state";

describe("common states", () => {
  it("renders loading UI", () => {
    render(<LoadingState />);
    expect(screen.getByRole("status")).toHaveTextContent("読み込み中");
  });

  it("renders empty UI", () => {
    render(<EmptyState />);
    expect(screen.getByText("準備中です")).toBeInTheDocument();
  });

  it("renders error UI", () => {
    render(<ErrorState />);
    expect(screen.getByText("情報を表示できませんでした")).toBeInTheDocument();
  });
});
