import { render, screen } from "@testing-library/react";
import { PUBLIC_EXCHANGE_ONLY_PRIZE_FIXTURE, PUBLIC_USER_PRIZE_FIXTURE } from "@oripa/storefront-testkit";
import { ExchangeOnlyNotice } from "@/components/catalog/exchange-only-notice";
import { groupPrizes } from "@/components/draw/draw-result-fulfillment";
import { retainedSelection } from "@/components/prizes/prize-actions";
import { PrizeRow } from "@/components/prizes/prize-row";
import type { UserPrize } from "@/lib/platform";

it("lists every purchase-notice name once without adding a prize badge", () => {
  const view = render(<ExchangeOnlyNotice names={[]} />);
  expect(view.container).toBeEmptyDOMElement();
  view.rerender(<ExchangeOnlyNotice names={["景品B", "景品D"]} />);
  expect(screen.getAllByText("「コイン交換限定」の景品は、獲得後にコインへの交換のみ行えます（発送はできません）。")).toHaveLength(1);
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  view.rerender(<PrizeRow checked={false} disabled={false} onToggle={() => {}} prize={PUBLIC_USER_PRIZE_FIXTURE} />);
  expect(view.container).not.toHaveTextContent("コイン交換限定");
});

it("keeps different classifications separate even with identical rights and presentation", () => {
  const a = { ...PUBLIC_USER_PRIZE_FIXTURE, id: "A" };
  const b = { ...a, exchange_only: PUBLIC_EXCHANGE_ONLY_PRIZE_FIXTURE.exchange_only, id: "B" };
  expect(groupPrizes([a, b])).toHaveLength(2);
  expect(groupPrizes([a, { ...b, exchange_only: false }])).toHaveLength(1);
});

it("retains only requested, still selectable and exchangeable nonshipping IDs", () => {
  const b: UserPrize = { ...PUBLIC_USER_PRIZE_FIXTURE, id: "B", allowed_actions: {
    ...PUBLIC_USER_PRIZE_FIXTURE.allowed_actions!, shipping: { allowed: false, unavailable_reason: "status_not_actionable" },
  } };
  expect([...retainedSelection([PUBLIC_USER_PRIZE_FIXTURE, b, { ...b, id: "D" }, { ...b, id: "unselected" }], ["B", "D", PUBLIC_USER_PRIZE_FIXTURE.id])]).toEqual(["B", "D"]);
});
