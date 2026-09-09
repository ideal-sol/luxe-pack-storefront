import { render, waitFor } from "@testing-library/react";
import { AdvertisingCapture } from "@/components/advertising/advertising-capture";

const route = vi.hoisted(() => ({ pathname: "/", search: "ad_code=ABC123xy" }));
const capture = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useSearchParams: () => new URLSearchParams(route.search),
}));
vi.mock("@/lib/platform/advertising-client", () => ({ advertisingLastClick: { capture } }));

it("captures landings and nested client navigation at the common root without rendering UI", async () => {
  const view = render(<AdvertisingCapture />);
  await waitFor(() => expect(capture).toHaveBeenLastCalledWith("ad_code=ABC123xy"));
  expect(view.container).toBeEmptyDOMElement();
  route.pathname = "/points/purchase";
  route.search = "ad_code=Def456Z9";
  view.rerender(<AdvertisingCapture />);
  await waitFor(() => expect(capture).toHaveBeenLastCalledWith("ad_code=Def456Z9"));
  route.pathname = "/gacha/example";
  view.rerender(<AdvertisingCapture />);
  await waitFor(() => expect(capture).toHaveBeenCalledTimes(3));
  route.search = "";
  view.rerender(<AdvertisingCapture />);
  await waitFor(() => expect(capture).toHaveBeenLastCalledWith(""));
  expect(view.container).toBeEmptyDOMElement();
});
