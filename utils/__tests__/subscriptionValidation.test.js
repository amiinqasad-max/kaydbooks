const { evaluateAndroidSubscription, evaluateAppleReceipt } = require('../subscriptionValidation');

const NOW = new Date('2026-06-01T00:00:00Z').getTime();
const future = (days) => String(NOW + days * 24 * 60 * 60 * 1000);
const past = (days) => String(NOW - days * 24 * 60 * 60 * 1000);

describe('evaluateAndroidSubscription (regression test for the purchaseType bug)', () => {
  test('a real paying customer (paymentState=1, no purchaseType field) is valid', () => {
    const result = evaluateAndroidSubscription(
      { paymentState: 1, expiryTimeMillis: future(30) },
      NOW
    );
    expect(result.isValid).toBe(true);
    expect(result.isTestPurchase).toBe(false);
  });

  test('an active free trial (paymentState=2) is valid', () => {
    const result = evaluateAndroidSubscription(
      { paymentState: 2, expiryTimeMillis: future(7) },
      NOW
    );
    expect(result.isValid).toBe(true);
  });

  test('a pending payment (paymentState=0) is NOT valid, even if not yet expired', () => {
    const result = evaluateAndroidSubscription(
      { paymentState: 0, expiryTimeMillis: future(30) },
      NOW
    );
    expect(result.isValid).toBe(false);
  });

  test('an expired subscription is NOT valid even with paymentState=1', () => {
    const result = evaluateAndroidSubscription(
      { paymentState: 1, expiryTimeMillis: past(1) },
      NOW
    );
    expect(result.isValid).toBe(false);
  });

  test('a test purchase (purchaseType=0) is flagged as a test but validity still follows paymentState/expiry, not purchaseType', () => {
    const validTest = evaluateAndroidSubscription(
      { paymentState: 1, expiryTimeMillis: future(30), purchaseType: 0 },
      NOW
    );
    expect(validTest.isValid).toBe(true);
    expect(validTest.isTestPurchase).toBe(true);

    const expiredTest = evaluateAndroidSubscription(
      { paymentState: 1, expiryTimeMillis: past(1), purchaseType: 0 },
      NOW
    );
    expect(expiredTest.isValid).toBe(false);
  });

  test('THE ORIGINAL BUG: a real purchase must not be rejected for lacking purchaseType === 0', () => {
    // This is exactly the shape of a genuine, currently-paying customer's
    // subscription payload. The buggy implementation required
    // `purchaseType === 0` to treat a purchase as valid, which would have
    // rejected this real customer.
    const realCustomer = { paymentState: 1, expiryTimeMillis: future(15) }; // no purchaseType field
    const result = evaluateAndroidSubscription(realCustomer, NOW);
    expect(result.isValid).toBe(true);
  });

  test('garbage/missing input is not valid', () => {
    expect(evaluateAndroidSubscription(null, NOW).isValid).toBe(false);
    expect(evaluateAndroidSubscription(undefined, NOW).isValid).toBe(false);
    expect(evaluateAndroidSubscription({}, NOW).isValid).toBe(false);
  });
});

describe('evaluateAppleReceipt', () => {
  test('a receipt with a future expiry is valid', () => {
    expect(evaluateAppleReceipt({ expires_date_ms: future(30) }, NOW).isValid).toBe(true);
  });

  test('a receipt with a past expiry is not valid', () => {
    expect(evaluateAppleReceipt({ expires_date_ms: past(1) }, NOW).isValid).toBe(false);
  });

  test('a receipt with no expiry field (non-renewing product) is treated as valid', () => {
    expect(evaluateAppleReceipt({ transaction_id: 'abc' }, NOW).isValid).toBe(true);
  });

  test('garbage input is not valid', () => {
    expect(evaluateAppleReceipt(null, NOW).isValid).toBe(false);
  });
});
