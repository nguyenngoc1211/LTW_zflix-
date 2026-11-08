import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProfilePage from './ProfilePage.jsx';
import AccountSecurityPage from './AccountSecurityPage.jsx';
import NotificationPreferencesSection from './NotificationPreferencesSection.jsx';

export default function SettingsPage() {
  const [params] = useSearchParams();
  const requestedSection = params.get('tab');
  const profileRef = useRef(null);
  const securityRef = useRef(null);
  const notificationsRef = useRef(null);
  const [active, setActive] = useState(['security', 'notifications'].includes(requestedSection) ? requestedSection : 'profile');

  useEffect(() => {
    if (!['profile', 'security', 'notifications'].includes(requestedSection)) return undefined;
    const target = requestedSection === 'security' ? securityRef.current : requestedSection === 'notifications' ? notificationsRef.current : profileRef.current;
    if (!target) return undefined;
    let observer;
    const scrollWhenReady = () => {
      if (!target.querySelector('h1, h2')) return false;
      target.scrollIntoView({ behavior: 'auto', block: 'start' });
      observer?.disconnect();
      return true;
    };
    if (!scrollWhenReady()) {
      observer = new MutationObserver(scrollWhenReady);
      observer.observe(target, { childList: true, subtree: true });
    }
    return () => observer?.disconnect();
  }, [requestedSection]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0;
        const boundary = headerBottom + 32;
        const securityTop = securityRef.current?.getBoundingClientRect().top ?? Infinity;
        const notificationsTop = notificationsRef.current?.getBoundingClientRect().top ?? Infinity;
        setActive(notificationsTop <= boundary ? 'notifications' : securityTop <= boundary ? 'security' : 'profile');
      });
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); cancelAnimationFrame(frame); };
  }, []);

  const scrollTo = (target) => target.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return <main className="settings-page">
    <h1>Cài đặt tài khoản</h1>
    <div className="settings-layout">
      <nav aria-label="Cài đặt tài khoản" className="settings-nav">
        <button type="button" aria-current={active === 'profile' ? 'location' : undefined} onClick={() => scrollTo(profileRef)}>Hồ sơ cá nhân</button>
        <button type="button" aria-current={active === 'security' ? 'location' : undefined} onClick={() => scrollTo(securityRef)}>Bảo mật</button>
        <button type="button" aria-current={active === 'notifications' ? 'location' : undefined} onClick={() => scrollTo(notificationsRef)}>Thông báo</button>
      </nav>
      <div className="settings-content">
        <div ref={profileRef} id="settings-profile" className="settings-section"><ProfilePage /></div>
        <div ref={securityRef} id="settings-security" className="settings-section settings-security"><AccountSecurityPage /></div>
        <div ref={notificationsRef} id="settings-notifications" className="settings-section"><NotificationPreferencesSection /></div>
      </div>
    </div>
  </main>;
}
