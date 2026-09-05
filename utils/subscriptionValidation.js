/**
 * Pure, unit-testable versions of the purchase-validity rules used by
 * supabase/functions/verify-receipt/index.ts. The Edge Function runs on
 * Deno and isn't reachable by this project's Jest suite directly, so this
 * module exists to give the actual decision logic real, fast, regression
 * test coverage -- keep the two in sync when either changes.
 */

/**
 * Google Play Developer API `purchases.subscriptions.get` response shape
 * (the fields this app cares about).
 * @typedef {Object} AndroidSubscriptionPurchase
 * @property {number} [paymentState] 0=pending, 1=received, 2=free trial, 3=deferred
 * @property {string} [expiryTimeMillis]
 * @property {number} [purchaseType] 0=test, 1=promo, undefined=normal purchase
 * @property {number} [acknowledgementState]
 */

/**
 * THE FIX for the Phase 0 audit finding: validity is decided by payment
 * state + expiry, never by `purchaseType`. `purchaseType === 0` means this
 * was a license-tester TEST purchase -- it says nothing about whether the
 * purchase is currently entitled to premium access, and the previous
 * implementation used it as the success condition, which would reject
 * every real paying customer (who has no `purchaseType` field at all) and
 * accept only test purchases.
 *
 * @param {AndroidSubscriptionPurchase} sub
 * @param {number} [nowMs] injectable for tests
 * @returns {{ isValid: boolean, isTestPurchase: boolean, expiresAt: Date|null }}
 */
function evaluateAndroidSubscription(sub, nowMs = Date.now()) {
  if (!sub || typeof sub !== 'object') {
    return { isValid: false, isTestPurchase: false, expiresAt: null };
  }

  const expiryMs = sub.expiryTimeMillis ? parseInt(sub.expiryTimeMillis, 10) : 0;
  const paymentOk = sub.paymentState === 1 || sub.paymentState === 2;
  const notExpired = expiryMs > nowMs;

  return {
    isValid: Boolean(paymentOk && notExpired),
    isTestPurchase: sub.purchaseType === 0,
    expiresAt: expiryMs ? new Date(expiryMs) : null,
  };
}

/**
 * Apple `verifyReceipt` latest_receipt_info entry shape (fields used here).
 * @typedef {Object} AppleReceiptInfo
 * @property {string} [expires_date_ms]
 * @property {string} [transaction_id]
 */

/**
 * @param {AppleReceiptInfo} latest
 * @param {number} [nowMs]
 */
function evaluateAppleReceipt(latest, nowMs = Date.now()) {
  if (!latest || typeof latest !== 'object') {
    return { isValid: false, expiresAt: null };
  }
  const expiresMs = latest.expires_date_ms ? parseInt(latest.expires_date_ms, 10) : undefined;
  // No expiry field at all (e.g. a non-renewing/consumable product) is
  // treated as valid; an expiry in the past is not.
  const isValid = !expiresMs || expiresMs > nowMs;
  return { isValid, expiresAt: expiresMs ? new Date(expiresMs) : null };
}

module.exports = { evaluateAndroidSubscription, evaluateAppleReceipt };
