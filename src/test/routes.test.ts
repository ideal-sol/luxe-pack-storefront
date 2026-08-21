import { mobileNavigation, pointPurchaseDetailRoute, primaryNavigation, publicRoutes } from "@/lib/routes/navigation";

describe("navigation definitions", () => {
  it("keeps primary navigation routes in the screen map", () => {
    const routes = new Set<string>(publicRoutes);
    for (const item of [...primaryNavigation, ...mobileNavigation]) {
      expect(routes.has(item.href)).toBe(true);
    }
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

  it("contains every required placeholder route", () => {
    expect(publicRoutes).toEqual(expect.arrayContaining([
      "/", "/gachas", "/gachas/[slug]", "/draws/[drawRequestId]/result", "/login", "/register", "/points",
      "/points/purchase/[productId]", "/verify-email/error", "/notices", "/notices/[noticeId]", "/pages/[slug]", "/contact", "/mypage",
      "/mypage/points", "/mypage/draws", "/mypage/prizes", "/mypage/address", "/mypage/line",
    ]));
  });
});
