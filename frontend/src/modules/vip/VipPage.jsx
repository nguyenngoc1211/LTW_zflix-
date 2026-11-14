import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../hooks/useAuth.js';
import './vip.css';

const money = (value) => new Intl.NumberFormat('vi-VN').format(value) + ' ₫';
const date = (value) => value ? new Date(value).toLocaleString('vi-VN') : '—';
const statusLabel = { PENDING: 'Chờ thanh toán', WAITING_REVIEW: 'Chờ duyệt', PAID: 'Đã duyệt', REJECTED: 'Từ chối' };
const inProgress = (order) => ['PENDING', 'WAITING_REVIEW'].includes(order.status);

function OrderStatus({ status }) {
  return <span className={`vip-status vip-status-${status.toLowerCase()}`}>{statusLabel[status] || status}</span>;
}

export default function VipPage() {
  const { apiRequest } = useAuth();
  const [plans, setPlans] = useState([]);
  const [orders, setOrders] = useState([]);
  const [expires, setExpires] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [plansResponse, ordersResponse] = await Promise.all([
      apiRequest('/api/v1/vip/plans'), apiRequest('/api/v1/vip/orders'),
    ]);
    setPlans(plansResponse.plans || []);
    setOrders(ordersResponse.orders || []);
    setExpires(ordersResponse.vipExpiresAt);
  }, [apiRequest]);
  useEffect(() => { load().catch((cause) => setError(cause.message)); }, [load]);
  const act = async (path, body) => {
    setBusy(true); setError('');
    try {
      const response = await apiRequest(path, { method: 'POST', ...(body && { body: JSON.stringify(body) }) });
      await load();
      setSelectedId(response.order.id);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const copy = (value) => navigator.clipboard.writeText(String(value))
    .catch(() => setError('Không sao chép được. Hãy chọn và sao chép thủ công.'));
  const openOrder = orders.find(inProgress);
  const selectedOrder = orders.find((order) => order.id === selectedId);
  const detail = selectedOrder || openOrder;
  const activeVip = expires && new Date(expires) > new Date();
  const step = detail?.status === 'PENDING' ? 2 : detail?.status === 'WAITING_REVIEW' ? 3 : 4;

  return <main className="vip-page"><div className="vip-wrap">
    <header className="vip-heading">
      <div><span className="vip-kicker">ZFLIX VIP</span><h1>Một trải nghiệm xem phim trọn vẹn hơn.</h1>
        <p>Chọn gói phù hợp. Đơn chuyển khoản được xét duyệt thủ công trước khi kích hoạt VIP.</p></div>
      <div className="vip-account-status"><span>TRẠNG THÁI THÀNH VIÊN</span>
        <strong className={activeVip ? 'vip-active' : ''}>{activeVip ? 'VIP đang hoạt động' : 'Tài khoản thường'}</strong>
        <small>{activeVip ? `Hết hạn ${date(expires)}` : 'Chưa có thời hạn VIP'}</small></div>
    </header>
    {error && <p className="vip-error" role="alert">{error}</p>}

    <section className="vip-section" aria-label="Gói thành viên"><div className="vip-section-heading"><span>01 / CHỌN GÓI</span><h2>Gói thành viên</h2></div>
      <div className="vip-plans">{plans.map((plan) => <article className={`vip-card ${plan.months === 12 ? 'vip-card-year' : ''}`} key={plan.id}>
        <div className="vip-card-top"><span className="vip-plan-type">{plan.months === 1 ? 'THE MONTHLY PASS' : 'THE ANNUAL PASS'}</span>{plan.months === 12 && <span className="vip-plan-mark">Gói năm</span>}</div>
        <h3>{plan.name}</h3><div className="vip-price">{money(plan.amount)}<small>/{plan.months === 1 ? 'tháng' : 'năm'}</small></div>
        <ul><li>Truy cập nội dung dành cho thành viên VIP</li><li>Hiệu lực {plan.months} tháng lịch sau khi được duyệt</li><li>Gia hạn tiếp từ ngày hết hạn nếu đang có VIP</li></ul>
        <button type="button" disabled={busy} onClick={() => act('/api/v1/vip/orders', { planId: plan.id })}>Chọn gói {plan.months === 1 ? 'tháng' : 'năm'} <span aria-hidden="true">→</span></button>
      </article>)}</div>
    </section>

    <section className="vip-section" aria-label="Thanh toán VIP"><div className="vip-section-heading"><span>02 / THANH TOÁN</span><h2>{detail ? inProgress(detail) ? 'Đơn đang xử lý' : 'Chi tiết đơn đã hoàn tất' : 'Thanh toán'}</h2></div>
      {detail ? <div className="vip-payment">
        <ol className="vip-steps" aria-label="Các bước thanh toán">{['Chọn gói', 'Chuyển khoản', 'Chờ duyệt'].map((label, index) => <li key={label} className={step > index + 1 ? 'done' : step === index + 1 ? 'current' : ''}><span>{index + 1}</span>{label}</li>)}</ol>
        <div className={`vip-payment-grid ${inProgress(detail) ? '' : 'vip-payment-complete'}`}>
          <div className="vip-order-info"><div className="vip-order-title"><div><span className="vip-label">MÃ ĐƠN {detail.code}</span><h3>{detail.planName}</h3></div><OrderStatus status={detail.status} /></div>
            <dl><div><dt>Số tiền</dt><dd><strong>{money(detail.amount)}</strong>{detail.status === 'PENDING' && detail.bank?.mode === 'LIVE' && <button className="vip-copy" onClick={() => copy(detail.amount)}>Sao chép</button>}</dd></div>
              <div><dt>Tạo lúc</dt><dd>{date(detail.createdAt)}</dd></div>
              {detail.bank?.mode === 'LIVE' && inProgress(detail) && <><div><dt>Ngân hàng</dt><dd>{detail.bank.bankName}</dd></div><div><dt>Số tài khoản</dt><dd>{detail.bank.account} <button className="vip-copy" onClick={() => copy(detail.bank.account)}>Sao chép</button></dd></div><div><dt>Chủ tài khoản</dt><dd>{detail.bank.accountName}</dd></div><div><dt>Nội dung</dt><dd>{detail.code} <button className="vip-copy" onClick={() => copy(detail.code)}>Sao chép</button></dd></div></>}
              {detail.reviewedAt && <div><dt>Xét duyệt lúc</dt><dd>{date(detail.reviewedAt)}</dd></div>}
              {detail.vipEndDate && <div><dt>VIP đến</dt><dd>{date(detail.vipEndDate)}</dd></div>}
            </dl>
            {detail.bank?.mode === 'DEMO' && inProgress(detail) && <p className="vip-demo-warning">QR DEMO — Không có tài khoản nhận. Không chuyển tiền thật.</p>}
            {detail.status === 'PENDING' && <button className="vip-confirm" disabled={busy} onClick={() => act(`/api/v1/vip/orders/${detail.id}/submit`)}>{detail.bank?.mode === 'LIVE' ? 'Tôi đã chuyển khoản' : 'Gửi đơn DEMO để xét duyệt'}</button>}
            {detail.status === 'WAITING_REVIEW' && <p className="vip-order-note">Đơn đã gửi. Vui lòng chờ Mod/Admin đối chiếu và xét duyệt.</p>}
            {detail.rejectionReason && <p className="vip-rejection">Lý do từ chối: {detail.rejectionReason}</p>}
          </div>
          {inProgress(detail) && <div className="vip-qr-panel"><div className="vip-qr"><QRCodeSVG value={detail.bank?.qrPayload || 'ZFLIX QR DEMO'} size={196} level="M" /></div><strong>{detail.bank?.mode === 'LIVE' ? 'Quét mã để chuyển khoản' : 'QR DEMO'}</strong><p>{detail.bank?.mode === 'LIVE' ? 'Kiểm tra số tiền và mã đơn trước khi xác nhận.' : 'Mã minh họa, không dùng để chuyển tiền.'}</p></div>}
        </div>
      </div> : <div className="vip-empty">Chọn một gói để tạo đơn. Mọi yêu cầu đều cần được xét duyệt trước khi cấp VIP.</div>}
    </section>

    <section className="vip-section vip-history" aria-label="Lịch sử thanh toán"><div className="vip-section-heading"><span>03 / THEO DÕI</span><h2>Lịch sử thanh toán</h2></div>
      {orders.length === 0 ? <div className="vip-empty">Bạn chưa có đơn VIP nào.</div> : <div className="vip-table-wrap"><table><thead><tr><th>Mã đơn</th><th>Gói VIP</th><th>Thời gian</th><th>Số tiền</th><th>Trạng thái</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className={detail?.id === order.id ? 'selected' : ''}>
        <td data-label="Mã đơn"><button type="button" className="vip-order-link" onClick={() => setSelectedId(order.id)}>{order.code}</button></td><td data-label="Gói VIP">{order.planName}</td><td data-label="Thời gian">{date(order.createdAt)}</td><td data-label="Số tiền">{money(order.amount)}</td><td data-label="Trạng thái"><OrderStatus status={order.status} /></td>
      </tr>)}</tbody></table></div>}
    </section>
  </div></main>;
}
