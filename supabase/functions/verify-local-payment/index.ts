// verify-local-payment
//
// Activates a subscription from a manually-reconciled payment (e.g. bank
// transfer / mobile money in a market without card-based IAP). The trust
// model: a member of staff creates an UNVERIFIED `local_payments` row out
// of band (after confirming the money actually arrived) with an
// unguessable `transaction_code`; the customer then enters that same code
// in the app to self-activate immediately. `local_payments` has no RLS
// policy for `authenticated`/`anon` (see migration 003), so a user cannot
// create their own row -- only this function (service_role) or a staff
// tool can.
//
// Fixes applied in this pass:
//  1. IDENTITY: uses the caller's verified JWT instead of a client-supplied
//     `userId` field -- the previous version let any caller pass any
//     `userId`, so a user submitting a valid transaction code they were
//     given could credit a *different* account instead of their own.
//  2. TABLE: writes to `subscriptions`, matching verify-receipt, instead of
//     a `users` table whose existence in production is unconfirmed (see
//     database/SCHEMA_DRIFT_REPORT.md).
//  3. Binds the payment to the caller on first use and refuses to let a
//     second, different account redeem the same code afterwards.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { transactionCode, plan } = await req.json()

    if (!transactionCode || !plan) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: transactionCode, plan' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (!['monthly', 'yearly'].includes(plan)) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: payment, error: fetchError } = await supabaseAdmin
      .from('local_payments')
      .select('*')
      .eq('transaction_code', transactionCode)
      .single()

    if (fetchError || !payment) {
      return new Response(
        JSON.stringify({ error: 'Invalid transaction code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (payment.verified) {
      // Already used. Only the account it was originally verified for may
      // treat re-submitting the same code as a harmless no-op (e.g. retry
      // after a network blip); anyone else gets a clear rejection.
      if (payment.user_id === userId) {
        return new Response(
          JSON.stringify({ success: true, message: 'Already activated for this account.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({ error: 'This transaction code has already been used.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const expectedAmount = plan === 'monthly' ? 4.99 : 49.99
    if (Number(payment.amount) !== expectedAmount || payment.plan !== plan) {
      return new Response(
        JSON.stringify({ error: 'Payment amount or plan does not match the submitted plan.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let expiresAt = new Date()
    if (plan === 'monthly') expiresAt.setMonth(expiresAt.getMonth() + 1)
    else expiresAt.setFullYear(expiresAt.getFullYear() + 1)

    const { error: subError } = await supabaseAdmin
      .from('subscriptions')
      .upsert({
        user_id: userId,
        provider: 'local',
        product_id: `local_${plan}`,
        plan,
        status: 'active',
        purchase_token: transactionCode,
        started_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'provider,purchase_token' })

    if (subError) throw subError

    const { error: verifyError } = await supabaseAdmin
      .from('local_payments')
      .update({ verified: true, user_id: userId, verified_at: new Date().toISOString() })
      .eq('transaction_code', transactionCode)

    if (verifyError) throw verifyError

    return new Response(
      JSON.stringify({
        success: true,
        subscriptionEnd: expiresAt.toISOString(),
        message: 'Payment verified and subscription activated',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('verify-local-payment error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
