import { LoadingState } from "@/components/common/loading-state";
import { PageContainer } from "@/components/layout/page-container";

export default function Loading() {
  return <PageContainer className="route-page"><LoadingState /></PageContainer>;
}
