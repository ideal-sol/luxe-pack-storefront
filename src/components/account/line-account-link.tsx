"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { CatalogLoading, CatalogMessage } from "@/components/catalog/catalog-message";
import { LoginRequiredState } from "@/components/common/state-panel";
import {
  presentExternalIdentityProblem,
  type ExternalIdentity,
  type ExternalIdentityProblemPresentation,
  type LineFriendState,
} from "@/lib/platform";
import { accountNavigation, lineAccountRoute } from "@/lib/routes/navigation";
import { useExternalIdentityClient } from "./external-identity-client-provider";

type IdentityState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly problem: ExternalIdentityProblemPresentation }
  | {
      readonly status: "ready";
      readonly friendState: LineFriendState;
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

function safeExternalHref(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
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
  const [actionProblem, setActionProblem] = useState<ExternalIdentityProblemPresentation | null>(null);
  const sessionUserId = session.status === "authenticated" ? session.session.user?.id ?? null : null;

  useEffect(() => {
    if (!client || !sessionUserId) return;
    let active = true;
    void Promise.all([client.listExternalIdentities(), client.getLineFriendState()])
      .then(([identities, friendState]) => {
        if (active) {
          setIdentityState({
            friendState: friendState.data,
            identities: identities.data.items,
            sessionUserId,
            status: "ready",
          });
        }
      })
      .catch((error: unknown) => {
        if (active) setIdentityState({ problem: presentExternalIdentityProblem(error), status: "error" });
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
      setActionProblem(presentExternalIdentityProblem(error));
      setStarting(false);
    }
  }

  if (session.status === "loading") return <CatalogLoading label="LINE連携状態を確認中" />;
  if (session.status === "unauthenticated") return <LoginRequiredState />;
  if (session.status === "session-expired") {
    return <CatalogMessage description="LINE連携を確認できませんでした、時間をおいて再度お試しください" eyebrow="ERROR" title="LINE連携を確認できませんでした" tone="error" />;
  }
  if (session.status === "configuration-unavailable" || !configurationAvailable) {
    return <CatalogMessage description="LINE連携を確認できませんでした" eyebrow="ERROR" title="LINE連携を表示できません" tone="error" />;
  }
  if (session.status === "error") {
    return <CatalogMessage description="LINE連携を確認できませんでした、時間をおいて再度お試しください" eyebrow="ERROR" title="LINE連携を表示できません" tone="error" />;
  }
  if (
    identityState.status === "idle"
    || identityState.status === "loading"
    || identityState.status === "ready" && identityState.sessionUserId !== sessionUserId
  ) {
    return <CatalogLoading label="LINE連携状態を確認中" />;
  }
  if (identityState.status === "error") {
    if (identityState.problem.sessionExpired) {
      return <CatalogMessage description="LINE連携を確認できませんでした、時間をおいて再度お試しください" eyebrow="ERROR" title="LINE連携を確認できませんでした" tone="error" />;
    }
    if (identityState.problem.authenticationRequired) return <LoginRequiredState />;
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
  const { friendState } = identityState;
  if (Boolean(lineIdentity) !== friendState.linked) {
    return (
      <CatalogMessage
        description="LINE連携を確認できませんでした"
        eyebrow="ERROR"
        title="LINE連携を確認できませんでした"
        tone="error"
      />
    );
  }

  const actionCode: string = friendState.primary_action.code;
  const actionLabel = friendState.primary_action.label;
  const externalHref = actionCode === "open_friend_add_url"
    ? safeExternalHref(friendState.primary_action.href)
    : null;

  return (
    <div className="line-account">
      <Link className="line-account__back" href={accountNavigation[0].href}>← マイページへ戻る</Link>
      <section
        aria-labelledby="line-account-heading"
        className={`line-account__card${friendState.linked ? " line-account__card--linked" : ""}`}
        data-is-line-user={String(friendState.is_line_user)}
        data-line-action-code={friendState.primary_action.code}
        data-line-status-code={friendState.status.code}
      >
        <div aria-hidden="true" className="line-account__mark">LINE</div>
        <div className="line-account__copy">
          <p>LINE FRIEND STATE</p>
          <h2 id="line-account-heading">{friendState.status.label}</h2>
          <span>現在のLINE連携・友だち追加済みです</span>
        </div>
        <div className="line-account__details">
          <dl aria-label="LINE Friend State">
            <div>
              <dt>LINE連携</dt>
              <dd>{friendState.linked ? "連携済み" : "未連携"}</dd>
            </div>
            <div>
              <dt>友だち追加確認</dt>
              <dd>{friendState.friend_confirmed ? "確認済み" : "未確認"}</dd>
            </div>
            <div>
              <dt>LINEユーザー</dt>
              <dd>{friendState.is_line_user ? "対象" : "対象外"}</dd>
            </div>
            {lineIdentity && (
              <div>
                <dt>連携日時</dt>
                <dd><time dateTime={lineIdentity.linked_at}>{formatDateTime(lineIdentity.linked_at)}</time></dd>
              </div>
            )}
          </dl>
          {actionCode === "start_identity_link" && actionLabel && (
            <button className="button button--dark line-account__link" disabled={starting} onClick={startLink} type="button">
              {starting ? "LINEへ移動中…" : actionLabel}
            </button>
          )}
          {actionCode === "open_friend_add_url" && actionLabel && externalHref && (
            <a className="button button--dark line-account__link" href={externalHref} rel="noopener noreferrer" target="_blank">
              {actionLabel}
            </a>
          )}
        </div>
      </section>

      {actionProblem && <p className="line-account__problem" role="alert">{actionProblem.message}</p>}
    </div>
  );
}
