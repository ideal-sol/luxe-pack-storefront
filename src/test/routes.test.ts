import { mobileNavigation, primaryNavigation, publicRoutes } from "@/lib/routes/navigation";

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

  it("contains every required placeholder route", () => {
    expect(publicRoutes).toEqual(expect.arrayContaining([
      "/", "/gachas", "/gachas/[slug]", "/draws/[drawRequestId]/result", "/login", "/register", "/points",
      "/verify-email/error", "/notices", "/notices/[noticeId]", "/pages/[slug]", "/contact", "/mypage",
      "/mypage/points", "/mypage/draws", "/mypage/prizes", "/mypage/line",
    ]));
  });
});
