import {
  mobileNavigation,
  paymentHistoryDetailRoute,
  pointPurchaseCardRegistrationReturnRoute,
  pointPurchaseDetailRoute,
  primaryNavigation,
  publicRoutes,
} from "@/lib/routes/navigation";

describe("navigation definitions", () => {
  it("keeps primary navigation routes in the screen map", () => {
    const routes = new Set<string>(publicRoutes);
    for (const item of [...primaryNavigation, ...mobileNavigation]) {
      expect(routes.has(item.href)).toBe(true);
    }
  });

  it("encodes the public opaque Payment identifier as one detail path segment", () => {
    expect(paymentHistoryDetailRoute("public/payment?attempt=1#detail")).toBe(
      "/mypage/purchases/public%2Fpayment%3Fattempt%3D1%23detail",
    );
  });

  it("uses Coin terminology without renaming the canonical Point routes", () => {
    expect(primaryNavigation.find((item) => item.href === "/points")?.label).toBe("コイン");
    expect(mobileNavigation.find((item) => item.href === "/points")?.label).toBe("コイン");
  });

  it("encodes the public Point Product identifier as one purchase-detail path segment", () => {
    expect(pointPurchaseDetailRoute("public/product?edition=1#summary")).toBe(
      "/points/purchase/public%2Fproduct%3Fedition%3D1%23summary",
    );
  });

  it("keeps Payment pid and Card Registration id on distinct Return correlations", () => {
    expect(pointPurchaseCardRegistrationReturnRoute(
      "public/product?edition=1#summary",
      "public/registration?attempt=1#return",
    )).toBe(
      "/points/purchase/public%2Fproduct%3Fedition%3D1%23summary?card_registration_id=public%2Fregistration%3Fattempt%3D1%23return",
    );
  });

  it("contains every required placeholder route", () => {
    expect(publicRoutes).toEqual(expect.arrayContaining([
      "/", "/gachas", "/gachas/[slug]", "/draws/[drawRequestId]/result", "/login", "/register", "/points",
      "/points/purchase/[productId]", "/verify-email/error", "/notices", "/notices/[noticeId]", "/pages/[slug]", "/contact", "/mypage",
      "/password-reset", "/password-reset/confirm", "/email-change/verify",
      "/mypage/points", "/mypage/draws", "/mypage/prizes", "/mypage/address", "/mypage/email", "/mypage/password", "/mypage/line",
      "/mypage/purchases", "/mypage/purchases/[paymentId]",
    ]));
  });
});
