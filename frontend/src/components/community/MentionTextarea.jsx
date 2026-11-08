import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../services/api.js';

export function MentionText({ text }) {
  return String(text || '').split(/(@[A-Za-z0-9_]{3,50})/g).map((part, index) =>
    /^@[A-Za-z0-9_]{3,50}$/.test(part) ? <strong className="mention-text" key={index}>{part}</strong> : part);
}

export default function MentionTextarea({ value, onChange, ...props }) {
  const ref = useRef(null);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(0);
  const [position, setPosition] = useState(null);
  const update = (next, cursor) => {
    onChange(next);
    const match = next.slice(0, cursor).match(/(?:^|\s)@([A-Za-z0-9_]{1,30})$/);
    setQuery(match?.[1] || '');
    setPosition(match ? { start: cursor - match[1].length - 1, end: cursor } : null);
    setSelected(0);
  };
  useEffect(() => {
    if (!query) return undefined;
    let live = true;
    const timer = setTimeout(() => apiRequest(`/api/v1/users/mention-suggestions?q=${encodeURIComponent(query)}`)
      .then((data) => { if (live) setItems(data.items || []); })
      .catch(() => { if (live) setItems([]); }), 180);
    return () => { live = false; clearTimeout(timer); };
  }, [query]);
  const choose = (user) => {
    if (!position) return;
    const insert = `@${user.username} `;
    onChange(value.slice(0, position.start) + insert + value.slice(position.end));
    setQuery(''); setItems([]); setPosition(null);
    requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(position.start + insert.length, position.start + insert.length); });
  };
  return <div className="mention-editor"><textarea {...props} ref={ref} value={value} onChange={(event) => update(event.target.value, event.target.selectionStart)}
    onKeyDown={(event) => {
      if (!query || !items.length) return;
      if (event.key === 'ArrowDown') { event.preventDefault(); setSelected((index) => (index + 1) % items.length); }
      if (event.key === 'ArrowUp') { event.preventDefault(); setSelected((index) => (index + items.length - 1) % items.length); }
      if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); choose(items[selected]); }
      if (event.key === 'Escape') { event.preventDefault(); setQuery(''); }
    }} />{query && items.length > 0 && <div role="listbox" aria-label="Gợi ý người dùng" className="mention-suggestions">{items.map((user, index) =>
      <button type="button" role="option" aria-selected={index === selected} key={user.id} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(user)}>@{user.username}</button>)}</div>}</div>;
}
