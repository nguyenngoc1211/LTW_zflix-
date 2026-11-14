import test from 'node:test';
import assert from 'node:assert/strict';
import { addCalendarMonths, bankSettings, billingMonths, transferPayload } from '../src/modules/payments/vip-payment.service.js';

test('calendar month renewal clamps to the last day and preserves time', () => {
  assert.equal(addCalendarMonths(new Date('2024-01-31T12:30:00.000Z'), 1).toISOString(), '2024-02-29T12:30:00.000Z');
  assert.equal(addCalendarMonths(new Date('2025-01-31T12:30:00.000Z'), 1).toISOString(), '2025-02-28T12:30:00.000Z');
  assert.equal(addCalendarMonths(new Date('2024-02-29T12:30:00.000Z'), 12).toISOString(), '2025-02-28T12:30:00.000Z');
});

test('only month and year plans are offered from legacy data', () => {
  assert.equal(billingMonths({ duration_days: 30 }), 1);
  assert.equal(billingMonths({ duration_days: 365 }), 12);
  assert.equal(billingMonths({ duration_days: 180 }), null);
});

test('unconfigured bank emits a nonpayable demo payload', () => {
  const original = [process.env.VIP_BANK_BIN, process.env.VIP_BANK_ACCOUNT,
    process.env.VIP_BANK_NAME, process.env.VIP_BANK_ACCOUNT_NAME];
  delete process.env.VIP_BANK_BIN; delete process.env.VIP_BANK_ACCOUNT;
  delete process.env.VIP_BANK_NAME; delete process.env.VIP_BANK_ACCOUNT_NAME;
  try {
    const bank = bankSettings();
    assert.equal(bank.mode, 'DEMO');
    assert.match(transferPayload({ bank, amount: 69000, code: 'ZVIPTEST' }), /QR DEMO - KHONG CHUYEN TIEN/);
  } finally {
    ['VIP_BANK_BIN', 'VIP_BANK_ACCOUNT', 'VIP_BANK_NAME', 'VIP_BANK_ACCOUNT_NAME'].forEach((key, index) => {
      if (original[index] === undefined) delete process.env[key]; else process.env[key] = original[index];
    });
  }
});

test('live payload encodes the destination, exact amount and order code with CRC', () => {
  const bank = { mode: 'LIVE', bin: '970415', account: '123456789', bankName: 'Test', accountName: 'Test' };
  const payload = transferPayload({ bank, amount: 69000, code: 'ZVIPTEST' });
  assert.match(payload, /^00020101021238/);
  assert.match(payload, /970415/);
  assert.match(payload, /123456789/);
  assert.match(payload, /540569000/);
  assert.match(payload, /ZVIPTEST6304[0-9A-F]{4}$/);
});
