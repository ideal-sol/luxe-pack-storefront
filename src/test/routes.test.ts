import { mobileNavigation, primaryNavigation, publicRoutes } from "@/lib/routes/navigation";

describe("navigation definitions", () => {
  it("keeps primary navigation routes in the screen map", () => {
    const routes = new Set<string>(publicRoutes);
    for (const item of [...primaryNavigation, ...mobileNavigation]) {
      expect(routes.has(item.href)).toBe(true);
    }
  });

  it("contains every required placeholder route", () => {
    expect(publicRoutes).toEqual(expect.arrayContaining([
      "/", "/gachas", "/gachas/[slug]", "/login", "/register", "/points",
      "/notices", "/notices/[noticeId]", "/pages/[slug]", "/mypage",
      "/mypage/points", "/mypage/draws", "/mypage/prizes", "/mypage/line",
    ]));
  });
});
