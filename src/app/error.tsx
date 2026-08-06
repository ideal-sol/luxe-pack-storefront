"use client";

import { ErrorState } from "@/components/common/state-panel";
import { PageContainer } from "@/components/layout/page-container";

export default function ErrorPage() {
  return <PageContainer className="route-page" size="narrow"><ErrorState /></PageContainer>;
}
