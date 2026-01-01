"use client";

import { useEffect, useState } from 'react';
import { toastPromise } from '@/lib/toast';

export default function CancelSubscriptionCard() {
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [cancellationScheduledFor, setCancellationScheduledFor] = useState<string | null>(null);
  const [alreadyCanceled, setAlreadyCanceled] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await fetch('/api/stripe/subscription', { cache: 'no-store' });
        if (res.status === 401) {
          if (isMounted) setIsSubscribed(false);
          return;
        }
        if (!res.ok) throw new Error('Failed to fetch subscription');
        const data: {
          isSubscribed: boolean;
          status: string | null;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: string | null;
        } = await res.json();
        if (isMounted) {
          setIsSubscribed(Boolean(data?.isSubscribed));
          setCancellationScheduledFor(data.cancelAtPeriodEnd ? data.currentPeriodEnd : null);
          setAlreadyCanceled(data.status === 'canceled');
        }
      } catch (e) {
        console.warn('[CancelSubscriptionCard] status error', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const onCancel = async () => {
    if (!isSubscribed || isCancelling) return;
    setIsCancelling(true);
    try {
      await toastPromise(
        fetch('/api/stripe/portal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flow: 'cancel' }),
        }).then(async (r) => {
          const json = await r.json();
          if (!r.ok) throw new Error(json?.error || 'Failed to open billing portal');
          return json as { url: string };
        }),
        {
          loading: 'Opening billing portal…',
          success: 'Redirecting to billing portal…',
          error: (e) => (e instanceof Error ? e.message : 'Failed to open billing portal'),
        },
      ).then((d) => {
        // Redirect user to Stripe Customer Portal to manage/cancel
        window.location.href = d.url;
      });
    } catch (e) {
      // handled by toastPromise
    } finally {
      setIsCancelling(false);
    }
  };

  const onResume = async () => {
    if (!isSubscribed || isResuming || !cancellationScheduledFor) return;
    setIsResuming(true);
    try {
      await toastPromise(
        fetch('/api/stripe/resume', { method: 'POST' }).then(async (r) => {
          const json = await r.json();
          if (!r.ok) throw new Error(json?.error || 'Resume failed');
          return json as { ok: true; alreadyActive: boolean; currentPeriodEnd: string | null };
        }),
        {
          loading: 'Resuming subscription…',
          success: 'Subscription resumed. Your plan continues as normal.',
          error: (e) => (e instanceof Error ? e.message : 'Failed to resume subscription'),
        },
      ).then(() => {
        setCancellationScheduledFor(null);
      });
    } catch (e) {
      // handled by toastPromise
    } finally {
      setIsResuming(false);
    }
  };

  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-8">
      <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">Subscription</h2>
      {loading ? (
        <p className="text-[var(--color-text-muted)]">Loading…</p>
      ) : alreadyCanceled ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-[var(--color-text-muted)]">Your subscription has been canceled.</p>
          <button
            type="button"
            onClick={() => (window.location.href = '/api/stripe/checkout')}
            className="inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            Upgrade to Pro
          </button>
        </div>
      ) : isSubscribed ? (
        <div className="space-y-4">
          {cancellationScheduledFor ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--color-text-muted)]">Cancellation scheduled. Access ends on {new Date(cancellationScheduledFor).toLocaleString()}.</span>
              <button
                type="button"
                onClick={onResume}
                disabled={isResuming}
                className="inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResuming ? 'Resuming…' : 'Resume Subscription'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={isCancelling}
                className="inline-flex items-center justify-center rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCancelling ? 'Cancelling…' : 'Cancel Subscription'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-[var(--color-text-muted)]">You are on the Free plan.</p>
          <button
            type="button"
            onClick={() => (window.location.href = '/api/stripe/checkout')}
            className="inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            Upgrade to Pro
          </button>
        </div>
      )}
    </div>
  );
}
