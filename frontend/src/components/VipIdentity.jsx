import { FaCrown } from 'react-icons/fa';
import { hasActiveVip } from './vipIdentity.js';

export default function VipIdentity({ username, vipExpiresAt, className = '' }) {
  const active = hasActiveVip(vipExpiresAt);
  return <span className={`vip-member-name ${active ? 'is-vip' : ''} ${className}`.trim()}>
    <span>{username}</span>{active && <span className="vip-member-badge" aria-label="Thành viên VIP"><FaCrown aria-hidden="true" /> VIP</span>}
  </span>;
}
