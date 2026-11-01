import { useState } from 'react';

const DEFAULT_AVATAR = '/default-avatar.png';
export default function UserAvatar({ src, className = '', alt = '' }) {
  const [failedSrc, setFailedSrc] = useState(null);
  return <img src={!src || failedSrc === src ? DEFAULT_AVATAR : src} alt={alt} className={className} onError={() => setFailedSrc(src)} />;
}
