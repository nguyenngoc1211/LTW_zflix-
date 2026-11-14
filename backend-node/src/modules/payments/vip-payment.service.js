import { randomBytes } from 'node:crypto';

export const billingMonths = (plan) => {
  const explicit = Number(plan?.billing_months);
  if ([1, 12].includes(explicit)) return explicit;
  const days = Number(plan?.duration_days);
  if (days >= 28 && days <= 31) return 1;
  if (days >= 365 && days <= 366) return 12;
  return null;
};

export const addCalendarMonths = (date, months) => {
  const source = new Date(date);
  const first = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1,
    source.getUTCHours(), source.getUTCMinutes(), source.getUTCSeconds(), source.getUTCMilliseconds()));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(source.getUTCDate(), lastDay));
  return first;
};

const tlv = (tag, value) => `${tag}${String(value.length).padStart(2, '0')}${value}`;
const crc16 = (value) => {
  let crc = 0xffff;
  for (const byte of Buffer.from(value, 'utf8')) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

export const bankSettings = () => {
  const bin = process.env.VIP_BANK_BIN?.trim() || '';
  const account = process.env.VIP_BANK_ACCOUNT?.trim() || '';
  const bankName = process.env.VIP_BANK_NAME?.trim() || '';
  const accountName = process.env.VIP_BANK_ACCOUNT_NAME?.trim() || '';
  const live = /^\d{6}$/.test(bin) && /^\d{4,19}$/.test(account) && bankName && accountName;
  return { mode: live ? 'LIVE' : 'DEMO', bin: live ? bin : null,
    account: live ? account : null, bankName: live ? bankName : null,
    accountName: live ? accountName : null };
};

export const transferPayload = ({ bank, amount, code }) => {
  if (bank.mode !== 'LIVE') return `ZFLIX QR DEMO - KHONG CHUYEN TIEN - ${code}`;
  const account = tlv('00', bank.bin) + tlv('01', bank.account);
  const merchant = tlv('00', 'A000000727') + tlv('01', account) + tlv('02', 'QRIBFTTA');
  const body = tlv('00', '01') + tlv('01', '12') + tlv('38', merchant) + tlv('53', '704')
    + tlv('54', String(amount)) + tlv('58', 'VN') + tlv('62', tlv('08', code)) + '6304';
  return body + crc16(body);
};

export const newOrderCode = () => `ZVIP${Date.now().toString(36).toUpperCase()}${randomBytes(4).toString('hex').toUpperCase()}`;
