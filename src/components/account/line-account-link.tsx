"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { CatalogLoading, CatalogMessage } from "@/components/catalog/catalog-message";
import { LoginRequiredState } from "@/components/common/state-panel";
import {
  presentPlatformProblem,
  type ExternalIdentity,
  type PlatformProblemPresentation,
} from "@/lib/platform";
import { accountNavigation, lineAccountRoute } from "@/lib/routes/navigation";
import { useExternalIdentityClient } from "./external-identity-client-provider";

type IdentityState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly problem: PlatformProblemPresentation }
  | {
      readonly status: "ready";
      readonly identities: readonly ExternalIdentity[];
      readonly sessionUserId: string;
    };

const dateTime = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

function formatDateTime(value: string) {
  return dateTime.format(new Date(value));
}

export function LineAccountLink({
  navigate = (url) => window.location.assign(url),
}: {
  readonly navigate?: (authorizationUrl: string) => void;
}) {
  const { state: session } = useSession();
  const { client, configurationAvailable } = useExternalIdentityClient();
  const [requestKey, setRequestKey] = useState(0);
  const [identityState, setIdentityState] = useState<IdentityState>({ status: "idle" });
  const [starting, setStarting] = useState(false);
  const [actionProblem, setActionProblem] = useState<PlatformProblemPresentation | null>(null);
  const sessionUserId = session.status === "authenticated" ? session.session.user?.id ?? null : null;

  useEffect(() => {
    if (!client || !sessionUserId) return;
    let active = true;
    void client.listExternalIdentities()
      .then(({ data }) => {
        if (active) setIdentityState({ identities: data.items, sessionUserId, status: "ready" });
      })
      .catch((error: unknown) => {
        if (active) setIdentityState({ problem: presentPlatformProblem(error), status: "error" });
      });
    return () => { active = false; };
  }, [client, requestKey, sessionUserId]);

  async function startLink() {
    if (!client || starting) return;
    setStarting(true);
    setActionProblem(null);
    try {
      const { data } = await client.startLineIdentityLink({ return_path: lineAccountRoute }, {});
      navigate(data.authorization_url);
    } catch (error) {
      setActionProblem(presentPlatformProblem(error));
      setStarting(false);
    }
  }

  if (session.status === "loading") return <CatalogLoading label="LINE連携状態を確認中" />;
  if (session.status === "unauthenticated" || session.status === "session-expired") return <LoginRequiredState />;
  if (session.status === "configuration-unavailable" || !configurationAvailable) {
    return <CatalogMessage description="この環境ではLINE連携への接続が設定されていません。" eyebrow="CONFIGURATION" title="LINE連携を表示できません" />;
  }
  if (session.status === "error") {
    return <CatalogMessage description="Sessionを確認できませんでした。時間をおいて再度お試しください。" eyebrow="ERROR" title="LINE連携を表示できません" tone="error" />;
  }
  if (
    identityState.status === "idle"
    || identityState.status === "loading"
    || identityState.status === "ready" && identityState.sessionUserId !== sessionUserId
  ) {
    return <CatalogLoading label="LINE連携状態を確認中" />;
  }
  if (identityState.status === "error") {
    if (identityState.problem.sessionExpired) return <LoginRequiredState />;
    return (
      <CatalogMessage
        action={() => {
          setIdentityState({ status: "loading" });
          setRequestKey((value) => value + 1);
        }}
        description={identityState.problem.message}
        eyebrow="ERROR"
        title="LINE連携状態を取得できませんでした"
        tone="error"
      />
    );
  }

  const lineIdentity = identityState.identities.find((identity) => identity.provider === "line");

  return (
    <div className="line-account">
      <Link className="line-account__back" href={accountNavigation[0].href}>← マイページへ戻る</Link>
      <section aria-labelledby="line-account-heading" className={`line-account__card${lineIdentity ? " line-account__card--linked" : ""}`}>
        <div aria-hidden="true" className="line-account__mark">LINE</div>
        <div className="line-account__copy">
          <p>{lineIdentity ? "CONNECTED" : "NOT CONNECTED"}</p>
          <h2 id="line-account-heading">{lineIdentity ? "LINE連携済み" : "LINEは未連携です"}</h2>
          <span>
            {lineIdentity
              ? "このアカウントにはLINE Identityが連携されています。"
              : "LINEの認証画面で本人確認を行い、このアカウントへ連携できます。"}
          </span>
        </div>
        {lineIdentity ? (
          <dl>
            <div>
              <dt>連携日時</dt>
              <dd><time dateTime={lineIdentity.linked_at}>{formatDateTime(lineIdentity.linked_at)}</time></dd>
            </div>
          </dl>
        ) : (
          <button className="button button--dark line-account__link" disabled={starting} onClick={startLink} type="button">
            {starting ? "LINEへ移動中…" : "LINEアカウントを連携"}
          </button>
        )}
      </section>

      {actionProblem && <p className="line-account__problem" role="alert">{actionProblem.message}</p>}

      <aside className="line-account__notice">
        <h2>連携について</h2>
        <p>認証情報やLINE TokenはStorefrontへ保存しません。認証とCallback検証はPlatformの正式なExternal Identity境界で処理されます。</p>
      </aside>
    </div>
  );
}
