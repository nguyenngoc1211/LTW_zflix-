import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '../../services/api.js';
import './content-images.css';

const mediaUrl = (url) => url.startsWith('/') ? `${API_URL}${url}` : url;

export function ImageLightbox({ src, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (!src) return undefined;
    const previousFocus = document.activeElement;
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    closeRef.current?.focus();
    return () => { document.removeEventListener('keydown', onKeyDown); previousFocus?.focus?.(); };
  }, [src, onClose]);
  if (!src) return null;
  return createPortal(<div className="zflix-image-lightbox" role="dialog" aria-modal="true" aria-label="Xem ảnh lớn" onClick={onClose}>
    <button ref={closeRef} type="button" className="zflix-image-lightbox-close" aria-label="Đóng ảnh" onClick={onClose}>×</button>
    <img src={src} alt="Ảnh xem lớn" onClick={(event) => event.stopPropagation()} />
  </div>, document.body);
}

export function ContentImages({ urls = [], variant = 'post' }) {
  const [openImage, setOpenImage] = useState('');
  if (!urls.length) return null;
  return <>
    <div className={variant === 'post' ? `zflix-post-image-grid${urls.length === 1 ? ' zflix-post-image-grid--single' : ''}` : 'zflix-comment-images'}>
      {urls.map((url, index) => {
        const src = mediaUrl(url);
        return <button type="button" key={`${url}-${index}`} onClick={() => setOpenImage(src)} aria-label={`Xem ảnh ${index + 1} lớn`}>
          <img src={src} alt={variant === 'post' ? `Ảnh bài viết ${index + 1}` : `Ảnh bình luận ${index + 1}`} loading="lazy" />
        </button>;
      })}
    </div>
    <ImageLightbox src={openImage} onClose={() => setOpenImage('')} />
  </>;
}
