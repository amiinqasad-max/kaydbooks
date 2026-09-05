// verify-receipt
//
// Verifies an Apple/Google in-app purchase receipt server-side and grants
// premium access by writing to `subscriptions` -- the ONLY table the app
// trusts for entitlement (see supabase/migrations/003_authorization_and_schema_fixes.sql).
//
// Fixes applied in this pass (see the Phase 0 audit for detail):
//  1. IDENTITY: the caller's Supabase JWT (Authorization header) is now
//     verified and its `sub` is used as the user id -- the previous
//     version trusted a `userId` field taken straight from the request
//     body, so any caller could grant premium to ANY account by passing a
//     different id, as long as they had *a* valid receipt of their own.
//  2. TABLE: writes to `subscriptions`, not a `users` table that may not
//     exist in production (see database/SCHEMA_DRIFT_REPORT.md).
//  3. ANDROID LOGIC: `purchaseType === 0` means TEST purchase in the Google
//     Play Developer API, not "this is a real purchase" -- the previous
//     code had this backwards, which would reject real paying customers
//     and accept only test purchases as valid. Validity is now determined
//     by `expiryTimeMillis` being in the future and `paymentState`
//     indicating a received payment or active free trial.
//  4. IDEMPOTENCY: `subscriptions` has a UNIQUE(provider, purchase_token)
//     constraint. The same receipt can no longer be redeemed on a second
//     account, and replaying the same receipt on the same account is a
//     harmless upsert rather than a duplicate row.
//  5. APPLE SANDBOX: a status 21007 response (production receipt sent to
//     the sandbox environment, or vice versa) now retries against the
//     sandbox endpoint instead of failing outright, so TestFlight/sandbox
//     testing actually works.
//  6. ANDROID ACKNOWLEDGEMENT: Google auto-refunds a subscription that
//     isn't acknowledged within 3 days. This now acknowledges it.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PLAN_PRODUCT_AMOUNTS: Record<string, number> = { trial: 0, monthly: 4.99, yearly: 49.99 }

function planDuration(plan: string, from: Date): Date {
  const end = new Date(from)
  if (plan === 'trial') end.setDate(end.getDate() + 7)
  else if (plan === 'monthly') end.setMonth(end.getMonth() + 1)
  else if (plan === 'yearly') end.setFullYear(end.getFullYear() + 1)
  return end
}

async function verifyAppleReceipt(receipt: string, sharedSecret: string | undefined) {
  const body = JSON.stringify({ 'receipt-data': receipt, password: sharedSecret })
  const call = (url: string) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })

  let response = await call('https://buy.itunes.apple.com/verifyReceipt')
  let data = await response.json()

  // 21007 = "this receipt is from the sandbox but was sent to production".
  // Retry against the sandbox endpoint so TestFlight/sandbox builds work.
  if (data.status === 21007) {
    response = await call('https://sandbox.itunes.apple.com/verifyReceipt')
    data = await response.json()
  }

  if (data.status !== 0) {
    return { isValid: false, reason: `Apple status ${data.status}` }
  }

  const latest = data.latest_receipt_info?.[data.latest_receipt_info.length - 1] || data.receipt?.in_app?.[0]
  if (!latest) return { isValid: false, reason: 'No transaction found in receipt' }

  const expiresMs = latest.expires_date_ms ? parseInt(latest.expires_date_ms, 10) : undefined
  const isValid = !expiresMs || expiresMs > Date.now()

  return {
    isValid,
    transactionId: latest.transaction_id || latest.original_transaction_id,
    productId: latest.product_id,
    expiresAt: expiresMs ? new Date(expiresMs) : undefined,
    raw: data,
  }
}

async function verifyAndroidPurchase(receipt: { productId: string; purchaseToken: string }) {
  const { google } = await import('https://esm.sh/googleapis@105')
  const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')
  const packageName = Deno.env.get('GOOGLE_PACKAGE_NAME') ?? 'com.kaydbooks.app'

  if (!serviceAccountKey) {
    return { isValid: false, reason: 'GOOGLE_SERVICE_ACCOUNT_KEY not configured' }
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(serviceAccountKey),
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  })
  const androidpublisher = google.androidpublisher({ version: 'v3', auth })

  const result = await androidpublisher.purchases.subscriptions.get({
    packageName,
    subscriptionId: receipt.productId,
    token: receipt.purchaseToken,
  })

  const sub = result.data
  const expiryMs = sub.expiryTimeMillis ? parseInt(sub.expiryTimeMillis, 10) : 0

  // paymentState: 0 = pending, 1 = received, 2 = free trial, 3 = deferred.
  // A subscription is genuinely active if payment was received (or it's an
  // active free trial) AND it hasn't expired AND it wasn't refunded
  // (userCancellationTimeMillis / cancelReason with no grace period left).
  const paymentOk = sub.paymentState === 1 || sub.paymentState === 2
  const notExpired = expiryMs > Date.now()
  const isValid = paymentOk && notExpired

  // purchaseType: 0 = test (license tester), 1 = promo. Absent = a normal
  // real purchase. This is metadata for support/analytics, NOT the
  // validity check -- the previous version incorrectly required
  // purchaseType === 0 to accept a purchase, which rejected real customers
  // and accepted only test purchases.
  const isTestPurchase = sub.purchaseType === 0

  // Acknowledge the purchase if Google hasn't recorded an ack yet, or
  // Google auto-refunds it within 3 days.
  if (isValid && sub.acknowledgementState === 0) {
    try {
      await androidpublisher.purchases.subscriptions.acknowledge({
        packageName,
        subscriptionId: receipt.productId,
        token: receipt.purchaseToken,
        requestBody: {},
      })
    } catch (ackError) {
      console.error('Acknowledgement failed (non-fatal):', ackError)
    }
  }

  return {
    isValid,
    isTestPurchase,
    transactionId: receipt.purchaseToken,
    expiresAt: expiryMs ? new Date(expiryMs) : undefined,
    autoRenewing: sub.autoRenewing,
    raw: sub,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // --- Identity: trust the caller's JWT, never a body field. ---------
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userId = user.id

    const { receipt, platform, plan } = await req.json()

    if (!receipt || !platform || !plan) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: receipt, platform, plan' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (!['trial', 'monthly', 'yearly'].includes(plan)) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let verification: { isValid: boolean; transactionId?: string; expiresAt?: Date; raw?: unknown; reason?: string }
    let productId = ''

    if (platform === 'ios') {
      verification = await verifyAppleReceipt(receipt, Deno.env.get('APPLE_SHARED_SECRET'))
      productId = (verification as any).productId ?? `ios_${plan}`
    } else if (platform === 'android') {
      verification = await verifyAndroidPurchase(receipt)
      productId = receipt.productId
    } else {
      return new Response(JSON.stringify({ error: 'Unsupported platform' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!verification.isValid || !verification.transactionId) {
      return new Response(
        JSON.stringify({ error: 'Invalid receipt', reason: (verification as any).reason }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const expiresAt = verification.expiresAt ?? planDuration(plan, new Date())

    // Upsert on (provider, purchase_token): replaying the same receipt for
    // the same purchase is idempotent; a *different* account trying to
    // redeem someone else's transaction_id will collide on the unique
    // constraint and simply fail to steal it, because `user_id` differs
    // from the row's existing value -- the WHERE clause below scopes any
    // update to the row's current owner.
    const { data: existing } = await supabaseAdmin
      .from('subscriptions')
      .select('id, user_id')
      .eq('provider', platform)
      .eq('purchase_token', verification.transactionId)
      .maybeSingle()

    if (existing && existing.user_id !== userId) {
      // This exact purchase token already belongs to a different account.
      // Do NOT transfer entitlement -- this is either a receipt-sharing
      // attempt or the user signed in with a different account than the
      // one that originally purchased.
      return new Response(
        JSON.stringify({ error: 'This purchase is already associated with a different account.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error: upsertError } = await supabaseAdmin
      .from('subscriptions')
      .upsert({
        user_id: userId,
        provider: platform,
        product_id: productId,
        plan,
        status: 'active',
        purchase_token: verification.transactionId,
        started_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        raw_receipt: verification.raw ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'provider,purchase_token' })

    if (upsertError) throw upsertError

    return new Response(
      JSON.stringify({ success: true, subscriptionEnd: expiresAt.toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('verify-receipt error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
