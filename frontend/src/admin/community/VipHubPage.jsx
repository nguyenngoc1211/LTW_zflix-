import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import SubscriptionsAdminPage from '../subscriptions/SubscriptionsAdminPage.jsx';
import VipPaymentsAdminPage from '../subscriptions/VipPaymentsAdminPage.jsx';

export default function VipHubPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'payments' || user?.role !== 'admin' ? 'payments' : 'overview';
  return <div className="space-y-5"><div className="flex flex-wrap gap-2">{user?.role === 'admin' && <button onClick={() => setParams({})} className={`rounded-lg border px-4 py-2 text-sm ${view === 'overview' ? 'border-red-600 bg-red-900/30 text-white' : 'border-slate-700 text-slate-400'}`}>Gói VIP & doanh thu</button>}<button onClick={() => setParams({ view: 'payments' })} className={`rounded-lg border px-4 py-2 text-sm ${view === 'payments' ? 'border-red-600 bg-red-900/30 text-white' : 'border-slate-700 text-slate-400'}`}>Duyệt thanh toán</button></div>{view === 'overview' ? <SubscriptionsAdminPage /> : <VipPaymentsAdminPage />}</div>;
}
