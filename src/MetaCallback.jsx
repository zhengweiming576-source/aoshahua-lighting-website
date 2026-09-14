import { useEffect, useState } from 'react';

/**
 * Meta / Facebook OAuth callback landing page.
 *
 * Meta redirects the browser back to this site with either
 *   ?code=...&state=...                    (authorization granted)
 * or
 *   ?error=...&error_description=...       (authorization refused / failed)
 *
 * The desktop application ("AOSHAHUA AI Marketing Center") listens on
 * http://127.0.0.1:8765/meta/callback, so this page hands the authorization
 * result straight back to it, forwarding the original query string verbatim.
 *
 * When the URL carries no OAuth parameters at all (a bare visit to
 * /meta-callback), nothing is handed off: the page simply explains what it is
 * for and stays put, so an accidental visit never lands on a dead localhost.
 *
 * This is a standalone route: it is intentionally rendered WITHOUT the site
 * header, navigation or footer.
 */
const LOCAL_CALLBACK = 'http://127.0.0.1:8765/meta/callback';

/** Parameters Meta may append; any one of them means a real authorization result. */
const OAUTH_PARAM_KEYS = ['code', 'state', 'error', 'error_description'];

function localCallbackTarget() {
  if (typeof window === 'undefined') return LOCAL_CALLBACK;
  // Forward window.location.search verbatim so code / state / error /
  // error_description (and any extra parameters) survive unchanged.
  return `${LOCAL_CALLBACK}${window.location.search || ''}`;
}

function readOAuthParams() {
  const empty = {
    code: null,
    state: null,
    error: null,
    errorDescription: null,
    hasOAuthParams: false,
  };
  if (typeof window === 'undefined') return empty;

  const params = new URLSearchParams(window.location.search || '');
  return {
    code: params.get('code'),
    state: params.get('state'),
    error: params.get('error'),
    errorDescription: params.get('error_description'),
    hasOAuthParams: OAUTH_PARAM_KEYS.some((key) => params.has(key)),
  };
}

export default function MetaCallback() {
  const [target] = useState(localCallbackTarget);
  const [params] = useState(readOAuthParams);
  const willHandoff = params.hasOAuthParams;

  useEffect(() => {
    document.title = willHandoff
      ? 'Facebook authorization · AOSHAHUA AI Marketing Center'
      : 'Meta OAuth callback · AOSHAHUA AI Marketing Center';
    window.scrollTo(0, 0);
  }, [willHandoff]);

  useEffect(() => {
    // Only hand the browser back to the desktop app when Meta actually returned
    // an authorization result. A bare visit stays on this page.
    if (!willHandoff) return undefined;

    // Give the browser one paint so the status message is actually visible,
    // then hand the authorization result back to the desktop app.
    let done = false;
    const handoff = () => {
      if (done) return;
      done = true;
      window.location.replace(target);
    };
    const timer = window.setTimeout(handoff, 300);
    window.addEventListener('pageshow', handoff);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pageshow', handoff);
    };
  }, [willHandoff, target]);

  return (
    <main className="meta-callback">
      <div className="meta-callback__card">
        <span className="meta-callback__mark" aria-hidden="true">
          A
        </span>
        <p className="meta-callback__eyebrow">AOSHAHUA AI Marketing Center</p>

        {willHandoff ? (
          <>
            <h1 className="meta-callback__title">
              Facebook authorization received. Returning to AOSHAHUA AI Marketing Center...
            </h1>
            <p className="meta-callback__note">
              If your browser blocks the automatic return, use the button below to continue.
            </p>
            <a className="meta-callback__link" href={target} rel="noopener">
              Return to AOSHAHUA AI Marketing Center
            </a>
            <span className="meta-callback__spinner" aria-hidden="true" />
            {params.error || params.errorDescription ? (
              <p className="meta-callback__detail" role="status">
                {[params.error, params.errorDescription].filter(Boolean).join(' — ')}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <h1 className="meta-callback__title">Meta OAuth callback is ready.</h1>
            <p className="meta-callback__note">
              This page will return authorization results to AOSHAHUA AI Marketing Center when
              Facebook authorization is completed.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
