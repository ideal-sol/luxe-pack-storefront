"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ContentFooterPage } from "@/lib/platform";
import { staticPageRoute } from "@/lib/routes/navigation";
import { usePublicClient } from "@/components/catalog/public-client-provider";

type FooterNavigationState =
  | { readonly status: "loading" }
  | { readonly status: "unavailable" }
  | { readonly status: "ready"; readonly pages: readonly ContentFooterPage[] };

export function FooterInformationNavigation() {
  const { client, configurationAvailable } = usePublicClient();
  const [state, setState] = useState<FooterNavigationState>(
    configurationAvailable ? { status: "loading" } : { status: "unavailable" },
  );

  useEffect(() => {
    if (!client) return;
    let active = true;
    void client.listFooterPages()
      .then(({ data }) => {
        if (active) setState({ status: "ready", pages: data.items });
      })
      .catch(() => {
        if (active) setState({ status: "unavailable" });
      });
    return () => { active = false; };
  }, [client]);

  if (state.status !== "ready") return null;

  return state.pages.map((page) => (
    <Link href={staticPageRoute(page.slug)} key={page.id}>{page.title}</Link>
  ));
}
