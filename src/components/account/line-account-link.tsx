"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { CatalogLoading, CatalogMessage } from "@/components/catalog/catalog-message";
import { LoginRequiredState } from "@/components/common/state-panel";
import {
  presentExternalIdentityProblem,
  type ExternalIdentity,
  type ExternalIdentityAdapter,
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
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? value : null;
  } catch {
    return null;
  }
}

const callbackMessages = {
  friendship_check_failed: "友だち追加状態を確認できませんでした。もう一度お試しください。",
  reward_apply_failed: "LINE特典を反映できませんでした。もう一度お試しください。",
  line_auth_failed: "LINE認証を完了できませんでした。もう一度お試しください。",
} as const;

function rewardMessage(state: LineFriendState) {
  const reward = state.reward;
  if (!reward) return null;
  if (reward.granted) return "友だち追加特典は受け取り済みです";
  if (!reward.enabled) return null;
  if (state.linked && state.friend_confirmed) {
    return "LINE連携・友だち追加が完了しています。条件を満たした方はLINE特典を受け取れます。";
  }
  if (reward.point_amount === null) return null;
  return `${state.linked ? "" : "LINEと連携して"}公式アカウントを友だち追加すると、条件を満たした方に${reward.point_amount}コインをプレゼントします。`;
}

function loadLineState(client: ExternalIdentityAdapter) {
  return Promise.all([client.listExternalIdentities(), client.getLineFriendState()]);
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
  const startPending = useRef(false);
  const loadRequest = useRef<{
    client: ExternalIdentityAdapter;
    sessionUserId: string;
    requestKey: number;
    promise: ReturnType<typeof loadLineState>;
  } | null>(null);
  const [actionProblem, setActionProblem] = useState<ExternalIdentityProblemPresentation | null>(null);
  const sessionUserId = session.status === "authenticated" ? session.session.user?.id ?? null : null;

  useEffect(() => {
    if (!client || !sessionUserId) return;
    let active = true;
    // Reuse the in-flight read across effect replay so a one-time callback notice is not consumed twice.
    if (loadRequest.current?.client !== client || loadRequest.current.sessionUserId !== sessionUserId || loadRequest.current.requestKey !== requestKey) {
      loadRequest.current = { client, sessionUserId, requestKey, promise: loadLineState(client) };
    }
    void loadRequest.current.promise
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

  async function startLink(recheck = false) {
    if (!client || startPending.current) return;
    startPending.current = true;
    setStarting(true);
    setActionProblem(null);
    try {
      const { data } = recheck
        ? await client.startLineReauthentication({ return_path: lineAccountRoute }, {})
        : await client.startLineIdentityLink({ return_path: lineAccountRoute }, {});
      const authorizationUrl = safeExternalHref(data.authorization_url);
      if (!authorizationUrl) throw new Error("Invalid authorization URL");
      navigate(authorizationUrl);
    } catch (error) {
      setActionProblem(presentExternalIdentityProblem(error));
      setStarting(false);
      startPending.current = false;
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
  const rewardCopy = rewardMessage(friendState);
  const callbackMessage = friendState.callback_result ? callbackMessages[friendState.callback_result] : null;
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
          {rewardCopy && <span>{rewardCopy}</span>}
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
            <button className="button button--dark line-account__link" disabled={starting} onClick={() => startLink()} type="button">
              {starting ? "LINEへ移動中…" : actionLabel}
            </button>
          )}
          {actionCode === "open_friend_add_url" && actionLabel && externalHref && (
            <a className="button button--dark line-account__link" href={externalHref} rel="noopener noreferrer" target="_blank">
              {actionLabel}
            </a>
          )}
          {friendState.secondary_action?.code === "start_friendship_recheck" && (
            <button className="button button--dark line-account__link" disabled={starting} onClick={() => startLink(true)} type="button">
              {starting ? "LINEへ移動中…" : "友だち追加を確認する"}
            </button>
          )}
        </div>
      </section>

      {callbackMessage && <p className="line-account__problem" role="alert">{callbackMessage}</p>}
      {actionProblem && <p className="line-account__problem" role="alert">{actionProblem.message}</p>}
    </div>
  );
}
