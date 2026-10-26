import Script from "next/script";
import { gtmContainerId } from "@/lib/analytics/gtm";

/** GTM のベースタグ（<head> 側）。コンテナIDが無ければ何も出さない。 */
export function GoogleTagManagerScript() {
  const id = gtmContainerId();
  if (!id) return null;
  return (
    <Script id="google-tag-manager" strategy="afterInteractive">
      {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${id}');`}
    </Script>
  );
}

/** GTM の noscript（<body> の直後）。 */
export function GoogleTagManagerNoScript() {
  const id = gtmContainerId();
  if (!id) return null;
  return (
    <noscript>
      <iframe height="0" src={`https://www.googletagmanager.com/ns.html?id=${id}`} style={{ display: "none", visibility: "hidden" }} title="Google Tag Manager" width="0" />
    </noscript>
  );
}
