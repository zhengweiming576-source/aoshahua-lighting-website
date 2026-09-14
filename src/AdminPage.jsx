// 后台管理页：登录后查看全部询盘记录与统计。
//
// inquiries / inquiry_items 两张表的 RLS 只允许「已登录且在白名单 admins 里」
// 的用户 SELECT，所以即使这个页面打进了公开的前端包，匿名访客也读不到任何一行数据。
// 本页所有文案均为中文（内部使用）；对外前台页面保持英文。

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, ExternalLink, Eye, FileArchive, FileSpreadsheet, FileText, Image as ImageIcon, Loader2, LogOut, Paperclip, RefreshCw, RotateCcw, Trash2, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import { PRODUCTS } from './data';
import { SITE_URL } from './legalContent';

const STATUS_LABEL = { new: '待处理', handled: '已处理', invalid: '无效订单' };

// 「无效订单」和「已删除」都不计入件数、货值、产品排行与时间统计。
function isDeleted(row) {
  return Boolean(row && row.deleted_at);
}

function isCounted(row) {
  return Boolean(row) && !row.deleted_at && row.status !== 'invalid';
}

// 产品跳转：本站产品库里的直接打开它的前台详情页（?product= 深链接），
// 不在库里的（例如客户从 1688 店铺看到的编号）回 1688 商品页。
const PLACEHOLDER_IMG = '/assets/images/placeholder.svg';

const CATALOG_IDS = new Set(PRODUCTS.map((product) => String(product.id)));

// 产品缩略图：按产品编号回本站产品库取图；查不到（例如只存在于 1688 店铺的旧编号）用占位图。
const PRODUCT_IMAGES = new Map(PRODUCTS.map((product) => [String(product.id), product.image]));

function productImage(productId) {
  return PRODUCT_IMAGES.get(String(productId || '')) || PLACEHOLDER_IMG;
}

// SITE_URL 自带结尾斜杠，这里去掉，免得拼出 `//?product=`（线上会 404）。
const SITE_BASE = String(SITE_URL || '').replace(/\/+$/, '');

function productLink(productId) {
  const id = String(productId || '');
  if (!id) return null;
  if (CATALOG_IDS.has(id)) {
    return { href: `${SITE_BASE}/?product=${encodeURIComponent(id)}`, label: '查看产品页' };
  }
  return { href: `https://detail.1688.com/offer/${encodeURIComponent(id)}.html`, label: '查看 1688 商品页' };
}

function money(value) {
  return typeof value === 'number' ? `¥${value.toLocaleString('zh-CN')}` : '—';
}

// 买家提交的附件（图片 / 图纸 / 规格书 / 表格…）。admin 才能读：
// admin_inquiry_attachments 只回元数据，字节走 admin_attachment_data 按需取，
// 所以客户传 20 MB 的文件也不会把弹窗拖慢。之前整份 base64 随列表一起返回，
// 既慢，又因为写入时被当成文本存进 bytea 而导致预览全是破图。
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'heic', 'tif', 'tiff', 'avif'];

// 超过这个大小的图片不自动做缩略图，点「预览」时才拉字节。
const THUMB_MAX_BYTES = 3 * 1024 * 1024;

function fileExt(name) {
  return String(name || '').split('.').pop().toLowerCase();
}

// 图片按 mime 或扩展名判断：有些浏览器/文件类型拿不到 file.type，只信 mime 会把
// 明明是图片的附件当成普通文件。
function isImageFile(file) {
  return String(file.mime_type || '').startsWith('image/') || IMAGE_EXTS.includes(fileExt(file.file_name));
}

// 浏览器能在页内直接显示的类型：其余（Excel / Word / CAD / 压缩包…）点了「预览」
// 只会得到一个错误页或直接下载，所以那类文件干脆不提供预览，只给下载。
const TEXT_EXTS = ['txt', 'csv', 'log', 'md', 'json', 'xml'];

function previewKind(file) {
  const ext = fileExt(file.file_name);
  const mime = String(file.mime_type || '');
  if (isImageFile(file)) return 'image';
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
  if (TEXT_EXTS.includes(ext) || mime.startsWith('text/')) return 'text';
  return null;
}

// 不能预览的类型，在按钮上直接说清为什么要下载。
function downloadHint(file) {
  const ext = fileExt(file.file_name);
  if (['xls', 'xlsx'].includes(ext)) return 'Excel 表格：下载后用 Excel / WPS 打开';
  if (['doc', 'docx'].includes(ext)) return 'Word 文档：下载后打开';
  if (['ppt', 'pptx'].includes(ext)) return 'PPT：下载后打开';
  if (['zip', 'rar', '7z'].includes(ext)) return '压缩包：下载后解压';
  if (['dwg', 'dxf'].includes(ext)) return 'CAD 图纸：下载后用 CAD 软件打开';
  return '该格式浏览器无法直接打开，请下载后查看';
}

// 图标只让人一眼看出是什么文件，不参与任何判断。
function AttachIcon({ file }) {
  const ext = fileExt(file.file_name);
  if (isImageFile(file)) return <ImageIcon size={22} />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet size={22} />;
  if (['zip', 'rar', '7z'].includes(ext)) return <FileArchive size={22} />;
  return <FileText size={22} />;
}

function fileSizeText(bytes) {
  if (!bytes) return '—';
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function AttachmentList({ inquiryId }) {
  const [files, setFiles] = useState(null); // null = loading
  const [busy, setBusy] = useState({ id: '', how: '' }); // 哪个按钮正在读字节
  const [thumbs, setThumbs] = useState({}); // id -> 缩略图 object URL（只给图片）
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState(null); // { url, name, kind }
  const urls = useRef(new Map()); // id -> object URL：同一个文件只取一次

  useEffect(() => {
    let active = true;
    setFiles(null);
    setError('');
    (async () => {
      if (!supabase) { setFiles([]); return; }
      const { data, error: rpcError } = await supabase.rpc('admin_inquiry_attachments', { p_inquiry: inquiryId });
      if (!active) return;
      if (rpcError) {
        setError(`附件列表读取失败：${rpcError.message}`);
        setFiles([]);
        return;
      }
      setFiles(Array.isArray(data) ? data : []);
    })();
    return () => { active = false; };
  }, [inquiryId]);

  // 图片附件自动取一次字节画缩略图（一眼能看到图），但只给 3 MB 以内的取——
  // 十几 MB 的大图只在点「预览」时才拉，免得打开弹窗就卡住。
  useEffect(() => {
    if (!files || !files.length) return undefined;
    let cancelled = false;
    const wanted = files.filter((f) => isImageFile(f) && (f.size_bytes || 0) <= THUMB_MAX_BYTES);
    (async () => {
      for (const f of wanted) {
        try {
          const url = await bytesUrl(f);
          if (!cancelled) setThumbs((prev) => ({ ...prev, [f.id]: url }));
        } catch (err) {
          // 缩略图失败不影响下载，跳过即可。
        }
      }
    })();
    return () => { cancelled = true; };
  }, [files]);

  // 弹窗卸载时释放所有 object URL。
  useEffect(() => () => {
    urls.current.forEach((url) => URL.revokeObjectURL(url));
    urls.current.clear();
  }, []);

  // Esc 也能关掉图片预览（点遮罩或「关闭」同样有效）。
  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setLightbox(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightbox]);

  async function bytesUrl(file) {
    if (urls.current.has(file.id)) return urls.current.get(file.id);
    const { data, error: rpcError } = await supabase.rpc('admin_attachment_data', { p_id: file.id });
    if (rpcError) throw new Error(rpcError.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.data_b64) throw new Error('附件内容为空');
    const binary = atob(row.data_b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const url = URL.createObjectURL(
      new Blob([bytes], { type: row.mime_type || file.mime_type || 'application/octet-stream' })
    );
    urls.current.set(file.id, url);
    return url;
  }

  // 预览一律在页面内的查看层里显示（图片用 <img>，PDF/文本用 <iframe>），
  // 不再 window.open 开新标签：浏览器会拦弹窗，而且 Excel 之类的新标签只会报错。
  async function openFile(file, how) {
    setError('');
    setBusy({ id: file.id, how });
    try {
      const url = await bytesUrl(file);
      if (how === 'download') {
        const a = document.createElement('a');
        a.href = url;
        a.download = file.file_name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        setLightbox({ url, name: file.file_name, kind: previewKind(file) || 'text' });
      }
    } catch (err) {
      setError(`「${file.file_name}」${how === 'download' ? '下载' : '打开'}失败：${err.message}`);
    } finally {
      setBusy({ id: '', how: '' });
    }
  }

  if (files === null || !files.length) return null;
  return (
    <div className="admin__attach">
      <p className="admin__attach-title"><Paperclip size={14} /> 附件（{files.length}）</p>
      <ul className="admin__attach-list">
        {files.map((f) => {
          const kind = previewKind(f);
          const thumb = thumbs[f.id];
          return (
            <li key={f.id} className="admin__attach-item">
              {thumb ? (
                <button
                  type="button"
                  className="admin__attach-thumb admin__attach-thumb--image"
                  onClick={() => setLightbox({ url: thumb, name: f.file_name, kind: 'image' })}
                  title="点击放大"
                >
                  <img src={thumb} alt={f.file_name} />
                </button>
              ) : (
                <span className={`admin__attach-thumb admin__attach-thumb--${isImageFile(f) ? 'image' : 'file'}`}>
                  <AttachIcon file={f} />
                </span>
              )}
              <span className="admin__attach-name" title={f.file_name}>{f.file_name}</span>
              <span className="admin__attach-size">{fileSizeText(f.size_bytes)}</span>
              <span className="admin__attach-actions">
                {kind ? (
                  <button
                    type="button"
                    className="admin__attach-btn"
                    onClick={() => openFile(f, 'preview')}
                    disabled={busy.id === f.id}
                  >
                    {busy.id === f.id && busy.how === 'preview'
                      ? <Loader2 size={13} className="spin" />
                      : <Eye size={13} />}{' '}
                    预览
                  </button>
                ) : null}
                <button
                  type="button"
                  className="admin__attach-btn"
                  onClick={() => openFile(f, 'download')}
                  disabled={busy.id === f.id}
                  title={kind ? '下载到本地' : downloadHint(f)}
                >
                  {busy.id === f.id && busy.how === 'download'
                    ? <Loader2 size={13} className="spin" />
                    : <Download size={13} />}{' '}
                  下载
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      {error ? <p className="admin__attach-error">{error}</p> : null}
      {lightbox ? (
        <div className="admin__attach-lightbox" role="presentation" onClick={() => setLightbox(null)}>
          <div className="admin__attach-viewer" onClick={(event) => event.stopPropagation()}>
            <div className="admin__attach-viewer-bar">
              <span className="admin__attach-viewer-name">{lightbox.name}</span>
              <button type="button" className="admin__attach-close" onClick={() => setLightbox(null)}>
                <X size={16} /> 关闭
              </button>
            </div>
            {lightbox.kind === 'image' ? (
              <img src={lightbox.url} alt={lightbox.name} />
            ) : (
              <iframe src={lightbox.url} title={lightbox.name} />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatTime(value) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function shortDay(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function compactMoney(value) {
  if (!value) return '0';
  if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`;
  return String(Math.round(value));
}

const CHART_W = 780;
const CHART_H = 240;

/* 折线图：两条线分别是「询盘信息量」和「需求交易额度」。
   纯手写 SVG，不引第三方图表库 —— 体积小、配色跟站点一致、不受依赖影响。
   两条线量纲不同（条 vs 元），所以各用一套 Y 轴：左轴条数、右轴金额。
   鼠标划过每一列会显示该时段的明细（用 SVG <title>）。 */
function TrendChart({ slots }) {
  const n = slots.length;
  const maxCount = Math.max(1, ...slots.map((slot) => slot.count));
  const maxAmount = Math.max(0, ...slots.map((slot) => slot.amount));
  const totalCount = slots.reduce((sum, slot) => sum + slot.count, 0);
  const totalAmount = slots.reduce((sum, slot) => sum + slot.amount, 0);

  const padL = 44;
  const padR = 64;
  const padT = 16;
  const padB = 32;
  const innerW = CHART_W - padL - padR;
  const innerH = CHART_H - padT - padB;
  const step = n > 1 ? innerW / (n - 1) : 0;
  const xAt = (index) => (n > 1 ? padL + index * step : padL + innerW / 2);
  const yCount = (value) => padT + innerH - (value / maxCount) * innerH;
  const yAmount = (value) => padT + innerH - (maxAmount ? (value / maxAmount) * innerH : 0);
  const path = (value, yOf) =>
    slots.map((slot, index) => `${index ? 'L' : 'M'}${xAt(index).toFixed(1)},${yOf(value(slot)).toFixed(1)}`).join(' ');
  const hitWidth = n > 1 ? step : innerW;

  // X 轴标签：最多显示 12 个，并在必要时用最后一个桶替换掉前一个，免得末尾两个挤在一起。
  const labelStep = Math.max(1, Math.ceil(n / 12));
  const labelIndexes = new Set();
  for (let index = 0; index < n; index += labelStep) labelIndexes.add(index);
  const lastIndex = n - 1;
  if (!labelIndexes.has(lastIndex)) {
    if (labelIndexes.has(lastIndex - 1)) labelIndexes.delete(lastIndex - 1);
    labelIndexes.add(lastIndex);
  }

  return (
    <>
      <div className="admin__chart-legend">
        <span className="is-count">
          <i /> 询盘信息量 · 合计 {totalCount} 条
        </span>
        <span className="is-amount">
          <i /> 需求交易额度 · 合计 {money(totalAmount)}
        </span>
      </div>
      <svg className="admin__chart" viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label="询盘信息量与需求交易额度趋势">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padT + innerH * ratio;
          return (
            <g key={ratio}>
              <line className="admin__chart-grid" x1={padL} x2={CHART_W - padR} y1={y} y2={y} />
              <text className="admin__chart-tick" x={padL - 8} y={y + 4} textAnchor="end">
                {Math.round(maxCount * (1 - ratio))}
              </text>
              {maxAmount ? (
                <text className="admin__chart-tick" x={CHART_W - padR + 8} y={y + 4} textAnchor="start">
                  {compactMoney(maxAmount * (1 - ratio))}
                </text>
              ) : null}
            </g>
          );
        })}

        {/* 条数用实线、金额用虚线画在上层：两者量纲不同（条 vs 元），
            数据少的时候两条线的形状会完全重合，虚线压在上面才能同时看清。 */}
        <path className="admin__chart-line admin__chart-line--count" d={path((slot) => slot.count, yCount)} />
        {maxAmount ? <path className="admin__chart-line admin__chart-line--amount" d={path((slot) => slot.amount, yAmount)} /> : null}

        {slots.map((slot, index) => (
          <g key={slot.key}>
            <rect
              className="admin__chart-hit"
              x={xAt(index) - hitWidth / 2}
              y={padT}
              width={hitWidth}
              height={innerH}
            >
              <title>{`${slot.label}：询盘 ${slot.count} 条 · ${slot.pieces} 件 · ${money(slot.amount)}`}</title>
            </rect>
            {slot.count ? <circle className="admin__chart-dot admin__chart-dot--count" cx={xAt(index)} cy={yCount(slot.count)} r="3" /> : null}
            {maxAmount && slot.amount ? (
              <circle className="admin__chart-dot admin__chart-dot--amount" cx={xAt(index)} cy={yAmount(slot.amount)} r="3" />
            ) : null}
            {labelIndexes.has(index) ? (
              <text className="admin__chart-tick" x={xAt(index)} y={CHART_H - 10} textAnchor="middle">
                {slot.label}
              </text>
            ) : null}
          </g>
        ))}

        {totalCount === 0 ? (
          <text className="admin__chart-empty" x={CHART_W / 2} y={padT + innerH / 2} textAnchor="middle">
            该时段暂无有效询盘
          </text>
        ) : null}
      </svg>
    </>
  );
}

function toCsv(rows) {
  const head = [
    '询价编号',
    '收到时间',
    '公司',
    'WhatsApp',
    '邮箱',
    '国家/港口',
    '状态',
    '款数',
    '件数',
    '预估金额(元)',
    '产品明细',
    '客户留言',
  ];
  const body = rows.map((row) => [
    row.ref,
    formatTime(row.created_at),
    row.company || '',
    row.contact_name || '',
    row.email || '',
    row.country || '',
    STATUS_LABEL[row.status] || row.status,
    row.item_count,
    row.total_pieces,
    row.total_estimate == null ? '' : row.total_estimate,
    (row.items || []).map((item) => `${item.product_name} x${item.quantity}`).join(' | '),
    row.message || '',
  ]);
  return [head, ...body]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
}

export default function AdminPage() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  // 列表翻页：默认每页 10 条，可切 10/20/30/40/50。只影响表格显示多少行，
  // 上面那些统计卡片、产品排行、时间统计、CSV 导出仍然按「当前筛选的全部记录」算。
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [bucket, setBucket] = useState('month');
  const [spanYear, setSpanYear] = useState(new Date().getFullYear());
  const [spanMonth, setSpanMonth] = useState(new Date().getMonth());
  const [spanDay, setSpanDay] = useState(new Date().getDate());
  const [exportSpan, setExportSpan] = useState('month');
  const [openRef, setOpenRef] = useState(null);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [accountsBusy, setAccountsBusy] = useState(false);
  const [accountsError, setAccountsError] = useState('');
  const [accountsMsg, setAccountsMsg] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newGrant, setNewGrant] = useState(true);
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    document.title = '询盘管理 · 澳沙华照明';
    // 公用的 index.html 是为英文前台写的 lang="en"，后台是纯中文页面，这里纠正一下
    // （影响屏幕阅读器、断词和浏览器的翻译提示）。
    const previous = document.documentElement.lang;
    document.documentElement.lang = 'zh-CN';
    return () => {
      document.documentElement.lang = previous;
    };
  }, []);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError('');
    try {
      const { data: isAdmin, error: rpcError } = await supabase.rpc('is_admin');
      if (rpcError) throw new Error(rpcError.message);
      if (!isAdmin) {
        setAuthorized(false);
        setRows([]);
        return;
      }
      setAuthorized(true);

      const { data: inquiries, error: headError } = await supabase
        .from('inquiries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (headError) throw new Error(headError.message);

      const ids = (inquiries || []).map((row) => row.id);
      let items = [];
      if (ids.length) {
        const { data: itemRows, error: itemError } = await supabase
          .from('inquiry_items')
          .select('*')
          .in('inquiry_id', ids);
        if (itemError) throw new Error(itemError.message);
        items = itemRows || [];
      }

      const byInquiry = new Map();
      items.forEach((item) => {
        const list = byInquiry.get(item.inquiry_id) || [];
        list.push(item);
        byInquiry.set(item.inquiry_id, list);
      });

      setRows((inquiries || []).map((row) => ({ ...row, items: byInquiry.get(row.id) || [] })));
    } catch (err) {
      setError(err && err.message ? `加载询盘失败：${err.message}` : '加载询盘失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setChecking(false);
      return undefined;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session || null);
      setChecking(false);
      if (data.session) load();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next || null);
    });
    return () => {
      active = false;
      if (sub && sub.subscription) sub.subscription.unsubscribe();
    };
  }, [load]);

  async function handleSignIn(event) {
    event.preventDefault();
    setError('');
    setSigningIn(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: credentials.email.trim(),
      password: credentials.password,
    });
    setSigningIn(false);
    if (signInError) {
      setError(`登录失败：${signInError.message}`);
      return;
    }
    setCredentials({ email: '', password: '' });
    load();
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setRows([]);
    setAuthorized(false);
  }

  async function updateRow(row, patch, failLabel) {
    const { error: updateError } = await supabase.from('inquiries').update(patch).eq('id', row.id);
    if (updateError) {
      setError(`${failLabel}：${updateError.message}`);
      return false;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...patch } : r)));
    return true;
  }

  async function setStatus(row, next) {
    setError('');
    if (row.status === next) return;
    await updateRow(row, { status: next }, '更新状态失败');
  }

  // 软删除：只在库里落一个删除时间，件数与货值立刻从统计里移除，但随时能恢复。
  async function softDelete(row) {
    setError('');
    const ok = window.confirm(
      `确定把 ${row.ref} 移入「已删除」吗？\n\n它的件数、货值会立刻从统计里移除，之后可以在「已删除」里一键恢复。`
    );
    if (!ok) return;
    await updateRow(row, { deleted_at: new Date().toISOString() }, '删除失败');
  }

  async function restore(row) {
    setError('');
    await updateRow(row, { deleted_at: null }, '恢复失败');
  }

  // ---------------------------------------------------------- 账号管理 ---
  // 新增账号 / 授权 / 重置密码都走数据库里的 security definer 函数：
  // 浏览器只拿得到 anon key，创建 Auth 用户必须由服务端完成。

  const loadAccounts = useCallback(async () => {
    setAccountsBusy(true);
    setAccountsError('');
    const { data, error: rpcError } = await supabase.rpc('admin_list_accounts');
    if (rpcError) {
      setAccountsError(`读取账号列表失败：${rpcError.message}`);
      setAccounts([]);
    } else {
      setAccounts(data || []);
    }
    setAccountsBusy(false);
  }, []);

  function toggleAccounts() {
    const next = !accountsOpen;
    setAccountsOpen(next);
    setAccountsMsg('');
    setAccountsError('');
    if (next) loadAccounts();
  }

  async function createAccount(event) {
    event.preventDefault();
    setAccountsError('');
    setAccountsMsg('');
    const email = newEmail.trim();
    if (!email || newPassword.length < 8) {
      setAccountsError('请填写邮箱，密码至少 8 位');
      return;
    }
    setAccountsBusy(true);
    const { data, error: rpcError } = await supabase.rpc('admin_create_account', {
      p_email: email,
      p_password: newPassword,
      p_grant: newGrant,
    });
    setAccountsBusy(false);
    if (rpcError) {
      setAccountsError(`新建账号失败：${rpcError.message}`);
      return;
    }
    const created = (data && data.email) || email;
    setNewEmail('');
    setNewPassword('');
    setNewGrant(true);
    setAccountsMsg(
      newGrant
        ? `已创建 ${created}，并已授权（现在就能登录看后台）`
        : `已创建 ${created}，但暂未授权（他能登录，但看不到任何数据，需要你点「授权」）`
    );
    loadAccounts();
  }

  async function setAccess(row, granted) {
    setAccountsError('');
    setAccountsMsg('');
    setAccountsBusy(true);
    const { error: rpcError } = await supabase.rpc('admin_set_access', {
      p_user_id: row.user_id,
      p_granted: granted,
    });
    setAccountsBusy(false);
    if (rpcError) {
      setAccountsError(`${granted ? '授权' : '停用'}失败：${rpcError.message}`);
      return;
    }
    setAccountsMsg(granted ? `已授权 ${row.email}` : `已停用 ${row.email}，他现在看不到任何数据`);
    loadAccounts();
  }

  async function resetPassword(row) {
    setAccountsError('');
    setAccountsMsg('');
    const next = window.prompt(`给 ${row.email} 设置新密码（至少 8 位）：`);
    if (next === null) return;
    if (next.length < 8) {
      setAccountsError('密码至少 8 位，本次没有修改');
      return;
    }
    setAccountsBusy(true);
    const { error: rpcError } = await supabase.rpc('admin_reset_password', {
      p_user_id: row.user_id,
      p_password: next,
    });
    setAccountsBusy(false);
    if (rpcError) {
      setAccountsError(`重置密码失败：${rpcError.message}`);
      return;
    }
    setAccountsMsg(`已重置 ${row.email} 的密码，把新密码告诉他`);
  }

  // 删除账号：把 auth.users 里的登录账号整个删掉（和「停用」不同 —— 停用只是不给数据权限，
  // 人还能登录，随时点「授权」就恢复）。删掉的只是登录入口，询盘记录一条都不会动。
  // 不设黑名单：以后需要他回来，用同一个邮箱重新「新建账号」就行，和全新账号没区别。
  async function deleteAccount(row) {
    setAccountsError('');
    setAccountsMsg('');
    const ok = window.confirm(
      `确定要彻底删除 ${row.email} 吗？\n\n` +
        `· 他的登录账号会被删掉，从此不能再登录后台；\n` +
        `· 这个操作不能撤销，但以后可以用同一邮箱重新「新建账号」；\n` +
        `· 已经收到的询盘记录不受影响，一条都不会丢。\n\n` +
        `只想暂时不让他看数据的话，请改用「停用」。`
    );
    if (!ok) return;
    setAccountsBusy(true);
    const { error: rpcError } = await supabase.rpc('admin_delete_account', { p_user_id: row.user_id });
    setAccountsBusy(false);
    if (rpcError) {
      setAccountsError(`删除失败：${rpcError.message}`);
      return;
    }
    setAccountsMsg(`已删除 ${row.email}。以后要让他回来，用同一个邮箱重新「新建账号」即可。`);
    loadAccounts();
  }

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const productCounts = new Map();
    let pieces = 0;
    let estimate = 0;
    rows.forEach((row) => {
      if (!isCounted(row)) return;
      pieces += row.total_pieces || 0;
      if (row.total_estimate) estimate += Number(row.total_estimate);
      (row.items || []).forEach((item) => {
        const key = item.product_name;
        productCounts.set(key, (productCounts.get(key) || 0) + (item.quantity || 0));
      });
    });
    const live = rows.filter((row) => !isDeleted(row));
    return {
      total: live.length,
      fresh: live.filter((row) => row.status === 'new').length,
      lastWeek: live.filter((row) => new Date(row.created_at).getTime() >= weekAgo).length,
      invalid: live.filter((row) => row.status === 'invalid').length,
      deleted: rows.length - live.length,
      pieces,
      estimate,
      top: [...productCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    };
  }, [rows]);

  const years = useMemo(() => {
    const set = new Set(rows.map((row) => new Date(row.created_at).getFullYear()));
    set.add(new Date().getFullYear());
    return [...set].filter((year) => Number.isFinite(year)).sort((a, b) => b - a);
  }, [rows]);

  const daysInSpanMonth = useMemo(() => new Date(spanYear, spanMonth + 1, 0).getDate(), [spanYear, spanMonth]);
  const activeDay = Math.min(spanDay, daysInSpanMonth);

  // 时间统计：年 → 月 → 日 → 时层层下钻，也可以按 7 天切段，或跨年汇总。
  const timeStats = useMemo(() => {
    const counted = rows.filter(isCounted);
    const blank = () => ({ count: 0, pieces: 0, amount: 0 });
    const add = (slot, row) => {
      slot.count += 1;
      slot.pieces += row.total_pieces || 0;
      if (row.total_estimate) slot.amount += Number(row.total_estimate);
    };

    if (bucket === 'year') {
      const byYear = new Map();
      years.forEach((year) => byYear.set(year, blank()));
      counted.forEach((row) => {
        const year = new Date(row.created_at).getFullYear();
        if (!byYear.has(year)) byYear.set(year, blank());
        add(byYear.get(year), row);
      });
      return [...byYear.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([year, value]) => ({ key: String(year), label: `${year} 年`, ...value }));
    }

    if (bucket === 'week') {
      const start = new Date(spanYear, 0, 1).getTime();
      const end = new Date(spanYear + 1, 0, 1).getTime();
      const week = 7 * 24 * 3600 * 1000;
      const list = [];
      for (let from = start; from < end; from += week) {
        const to = Math.min(from + week - 1, end - 1);
        list.push({
          key: `w${from}`,
          label: `${shortDay(new Date(from))} – ${shortDay(new Date(to))}`,
          from,
          to,
          ...blank(),
        });
      }
      counted.forEach((row) => {
        const at = new Date(row.created_at).getTime();
        const slot = list.find((entry) => at >= entry.from && at <= entry.to);
        if (slot) add(slot, row);
      });
      return list;
    }

    if (bucket === 'day') {
      const list = Array.from({ length: daysInSpanMonth }, (_, index) => ({
        key: `d${index + 1}`,
        label: `${spanMonth + 1}/${index + 1}`,
        ...blank(),
      }));
      counted.forEach((row) => {
        const at = new Date(row.created_at);
        if (at.getFullYear() !== spanYear || at.getMonth() !== spanMonth) return;
        add(list[at.getDate() - 1], row);
      });
      return list;
    }

    if (bucket === 'hour') {
      const list = Array.from({ length: 24 }, (_, index) => ({
        key: `h${index}`,
        label: `${String(index).padStart(2, '0')}:00`,
        ...blank(),
      }));
      counted.forEach((row) => {
        const at = new Date(row.created_at);
        if (at.getFullYear() !== spanYear || at.getMonth() !== spanMonth || at.getDate() !== activeDay) return;
        add(list[at.getHours()], row);
      });
      return list;
    }

    const list = Array.from({ length: 12 }, (_, index) => ({
      key: `m${index + 1}`,
      label: `${index + 1} 月`,
      ...blank(),
    }));
    counted.forEach((row) => {
      const at = new Date(row.created_at);
      if (at.getFullYear() !== spanYear) return;
      add(list[at.getMonth()], row);
    });
    return list;
  }, [rows, bucket, spanYear, spanMonth, activeDay, daysInSpanMonth, years]);

  const timeTotals = useMemo(
    () =>
      timeStats.reduce(
        (acc, slot) => ({
          count: acc.count + slot.count,
          pieces: acc.pieces + slot.pieces,
          amount: acc.amount + slot.amount,
        }),
        { count: 0, pieces: 0, amount: 0 }
      ),
    [timeStats]
  );

  const maxCount = useMemo(
    () => timeStats.reduce((max, slot) => Math.max(max, slot.count), 0),
    [timeStats]
  );

  // 导出时段跟随面板上选的年 / 月 / 日，口径与图表一致（只含有效询盘）。
  const dayLabel = `${spanYear} 年 ${spanMonth + 1} 月 ${activeDay} 日`;
  const monthLabel = `${spanYear} 年 ${spanMonth + 1} 月`;
  const yearLabel = `${spanYear} 年`;

  const rangeText =
    bucket === 'year'
      ? '全部年份'
      : bucket === 'hour'
        ? dayLabel
        : bucket === 'day'
          ? monthLabel
          : yearLabel;

  const exportRangeText =
    exportSpan === 'all'
      ? '全部年份'
      : exportSpan === 'year'
        ? yearLabel
        : exportSpan === 'month'
          ? monthLabel
          : dayLabel;

  const exportRows = useMemo(() => {
    const counted = rows.filter(isCounted);
    if (exportSpan === 'all') return counted;
    return counted.filter((row) => {
      const at = new Date(row.created_at);
      if (at.getFullYear() !== spanYear) return false;
      if (exportSpan === 'year') return true;
      if (at.getMonth() !== spanMonth) return false;
      if (exportSpan === 'month') return true;
      return at.getDate() === activeDay;
    });
  }, [rows, exportSpan, spanYear, spanMonth, activeDay]);

  function downloadCsv(list, filename) {
    if (!list.length) return;
    const blob = new Blob(['\ufeff' + toCsv(list)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter === 'deleted') {
        if (!isDeleted(row)) return false;
      } else if (statusFilter !== 'all') {
        if (isDeleted(row) || row.status !== statusFilter) return false;
      } else if (isDeleted(row)) {
        return false;
      }
      if (!needle) return true;
      return [
        row.ref,
        row.company,
        row.contact_name,
        row.email,
        row.country,
        ...(row.items || []).map((item) => item.product_name),
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle));
    });
  }, [rows, query, statusFilter]);

  // ---- 分页：只切表格显示的那一段，filtered 本身保持完整 ----
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const pagedRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // 数据变少（比如这个状态下只剩 3 条）时把页码收回最后一页，别停在空页上。
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  // 页码按钮：超过 7 页就折叠成 1 … 4 5 6 … 20。
  const pageButtons = (() => {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
    const wanted = new Set([1, pageCount, safePage - 1, safePage, safePage + 1]);
    const list = [...wanted].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
    const out = [];
    list.forEach((n, i) => {
      if (i > 0 && n - list[i - 1] > 1) out.push('gap-' + n);
      out.push(n);
    });
    return out;
  })();

  function gotoPage(n) {
    setPage(Math.min(Math.max(1, n), pageCount));
    const wrap = document.querySelector('.admin__table-wrap');
    if (wrap && typeof wrap.scrollIntoView === 'function') wrap.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  const opened = rows.find((row) => row.ref === openRef) || null;

  if (!supabase) {
    return (
      <main className="admin">
        <div className="container admin__inner">
          <h1>询盘管理</h1>
          <p className="admin__note">
            当前构建未配置数据库。请设置 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY 后重新构建。
          </p>
        </div>
      </main>
    );
  }

  if (checking) {
    return (
      <main className="admin">
        <div className="container admin__inner">
          <p className="admin__note">
            <Loader2 size={16} className="spin" /> 正在检查登录状态…
          </p>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="admin">
        <div className="container admin__inner admin__inner--narrow">
          <h1>询盘管理</h1>
          <p className="admin__note">员工登录入口。客户的询盘来自前台产品页的询价购物车。</p>
          <form className="admin__login" onSubmit={handleSignIn}>
            <label>
              <span>邮箱</span>
              <input
                type="email"
                value={credentials.email}
                onChange={(e) => setCredentials((p) => ({ ...p, email: e.target.value }))}
                required
                autoComplete="username"
              />
            </label>
            <label>
              <span>密码</span>
              <input
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials((p) => ({ ...p, password: e.target.value }))}
                required
                autoComplete="current-password"
              />
            </label>
            {error ? <p className="admin__error">{error}</p> : null}
            <button type="submit" className="btn btn--primary" disabled={signingIn}>
              {signingIn ? '登录中…' : '登录'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="admin">
        <div className="container admin__inner admin__inner--narrow">
          <h1>无访问权限</h1>
          <p className="admin__note">
            你当前登录的账号是 <strong>{session.user && session.user.email}</strong>，但它不在询盘后台的白名单里。
            请把这个邮箱发给管理员加入白名单。
          </p>
          <button type="button" className="btn btn--ghost" onClick={handleSignOut}>
            <LogOut size={15} /> 退出登录
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="admin">
      <div className="container admin__inner">
        <header className="admin__head">
          <div>
            <p className="eyebrow">Aoshahua Lighting</p>
            <h1>询盘管理</h1>
          </div>
          <div className="admin__actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>
              <RefreshCw size={14} /> {loading ? '加载中…' : '刷新'}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={handleSignOut}>
              <LogOut size={14} /> 退出登录
            </button>
          </div>
        </header>

        <section className="admin__stats">
          <div className="statcard">
            <span>询盘总数</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="statcard">
            <span>待回复</span>
            <strong>{stats.fresh}</strong>
          </div>
          <div className="statcard">
            <span>近 7 天</span>
            <strong>{stats.lastWeek}</strong>
          </div>
          <div className="statcard">
            <span>累计件数（有效）</span>
            <strong>{stats.pieces.toLocaleString('zh-CN')}</strong>
          </div>
          <div className="statcard">
            <span>预估货值（有效）</span>
            <strong>{money(stats.estimate)}</strong>
          </div>
          <div className="statcard statcard--muted">
            <span>无效订单</span>
            <strong>{stats.invalid}</strong>
          </div>
        </section>
        <p className="admin__note admin__note--tight">
          「无效订单」和「已删除」都不计入累计件数、预估货值、产品排行和时间统计；「询盘总数」「近 7 天」只统计未删除的记录。
          {stats.deleted ? `当前有 ${stats.deleted} 条在「已删除」里，可随时恢复。` : ''}
        </p>

        <section className="admin__period">
          <div className="admin__period-head">
            <h2>时间统计</h2>
            <div className="admin__period-ctl">
              <div className="chips">
                {[
                  ['hour', '每小时'],
                  ['day', '每天'],
                  ['week', '每 7 天'],
                  ['month', '每月'],
                  ['year', '每年'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`chip-btn${bucket === value ? ' is-active' : ''}`}
                    onClick={() => setBucket(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="admin__period-year">
                <span>年份</span>
                <select
                  value={spanYear}
                  disabled={bucket === 'year'}
                  onChange={(e) => setSpanYear(Number(e.target.value))}
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year} 年
                    </option>
                  ))}
                </select>
              </label>
              {bucket === 'day' || bucket === 'hour' ? (
                <label className="admin__period-year">
                  <span>月份</span>
                  <select value={spanMonth} onChange={(e) => setSpanMonth(Number(e.target.value))}>
                    {Array.from({ length: 12 }, (_, index) => (
                      <option key={index} value={index}>
                        {index + 1} 月
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {bucket === 'hour' ? (
                <label className="admin__period-year">
                  <span>日期</span>
                  <select value={activeDay} onChange={(e) => setSpanDay(Number(e.target.value))}>
                    {Array.from({ length: daysInSpanMonth }, (_, index) => (
                      <option key={index} value={index + 1}>
                        {index + 1} 日
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          </div>
          <p className="admin__sub admin__period-note">
            统计口径：{rangeText}
            {bucket === 'week' ? '（按 1 月 1 日起每 7 天为一个区间）' : ''}
            {bucket === 'hour' ? '（按小时）' : ''}
            ；只统计有效询盘（已排除无效订单与已删除）。
          </p>

          <TrendChart slots={timeStats} />

          <div className="admin__period-export">
            <label className="admin__period-year">
              <span>导出范围</span>
              <select value={exportSpan} onChange={(e) => setExportSpan(e.target.value)}>
                <option value="day">本日（{dayLabel}）</option>
                <option value="month">本月（{monthLabel}）</option>
                <option value="year">本年（{yearLabel}）</option>
                <option value="all">全部年份</option>
              </select>
            </label>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => downloadCsv(exportRows, `澳沙华-客户信息-${exportRangeText.replace(/\s+/g, '')}.csv`)}
            >
              导出客户信息 CSV{exportRows.length ? `（${exportRows.length} 条）` : ''}
            </button>
            <span className="admin__sub">
              {exportRows.length
                ? `${exportRangeText} · 含公司 / WhatsApp / 邮箱 / 国家 / 状态 / 件数 / 金额 / 产品明细 / 客户留言（不含无效与已删除）`
                : `${exportRangeText} 没有有效询盘，换个范围试试。`}
            </span>
          </div>
          <div className="admin__period-wrap">
            <table className="admin__table admin__period-table">
              <thead>
                <tr>
                  <th>时间区间</th>
                  <th>询盘数</th>
                  <th>件数</th>
                  <th>预估货值</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {timeStats.map((slot) => (
                  <tr key={slot.key} className={slot.count ? '' : 'is-empty'}>
                    <td>{slot.label}</td>
                    <td>{slot.count}</td>
                    <td>{slot.pieces.toLocaleString('zh-CN')}</td>
                    <td>{money(slot.amount)}</td>
                    <td className="admin__period-bar">
                      <span style={{ width: `${maxCount ? Math.max((slot.count / maxCount) * 100, slot.count ? 4 : 0) : 0}%` }} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>合计</th>
                  <th>{timeTotals.count}</th>
                  <th>{timeTotals.pieces.toLocaleString('zh-CN')}</th>
                  <th>{money(timeTotals.amount)}</th>
                  <th />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {stats.top.length ? (
          <section className="admin__top">
            <h2>最常被询价的产品</h2>
            <ul>
              {stats.top.map(([name, qty]) => (
                <li key={name}>
                  <span>{name}</span>
                  <strong>{qty.toLocaleString('zh-CN')} 件</strong>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="admin__toolbar">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="搜索询价编号、公司、邮箱、国家或产品名…"
          />
          <div className="admin__filters">
            {[
              ['all', '全部'],
              ['new', '待处理'],
              ['handled', '已处理'],
              ['invalid', '无效订单'],
              ['deleted', '已删除'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`chip${statusFilter === value ? ' is-active' : ''}`}
                onClick={() => {
                  setStatusFilter(value);
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="admin__pagesize">
            <span>每页</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              aria-label="每页显示多少条"
            >
              {[10, 20, 30, 40, 50].map((n) => (
                <option key={n} value={n}>
                  {n} 条
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => downloadCsv(filtered, '澳沙华-询盘记录.csv')}
          >
            导出 CSV{filtered.length ? `（${filtered.length} 条）` : ''}
          </button>
          {filtered.length === 0 ? (
            <span className="admin__sub">当前筛选结果为空，没有可导出的记录。</span>
          ) : null}
        </div>

        {error ? <p className="admin__error">{error}</p> : null}

        {filtered.length === 0 ? (
          <p className="admin__note">暂无符合条件的询盘。</p>
        ) : (
          <div className="admin__table-wrap">
            <table className="admin__table">
              <thead>
                <tr>
                  <th>询价编号</th>
                  <th>收到时间</th>
                  <th>公司 / WhatsApp</th>
                  <th>国家</th>
                  <th>款数</th>
                  <th>件数</th>
                  <th>预估金额</th>
                  <th>状态</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => (
                  <tr key={row.id} className={isCounted(row) ? undefined : 'is-muted'}>
                    <td>
                      <code>{row.ref}</code>
                    </td>
                    <td>{formatTime(row.created_at)}</td>
                    <td>
                      {row.company ? <strong>{row.company}</strong> : null}
                      <div className="admin__sub">
                        {row.contact_name} · {row.email}
                      </div>
                    </td>
                    <td>{row.country || '—'}</td>
                    <td>{row.item_count}</td>
                    <td>{row.total_pieces}</td>
                    <td>{money(row.total_estimate == null ? null : Number(row.total_estimate))}</td>
                    <td>
                      <span className={`pill pill--${isDeleted(row) ? 'deleted' : row.status}`}>
                        {isDeleted(row) ? '已删除' : STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    <td>
                      <div className="admin__rowbtns">
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpenRef(row.ref)}>
                          查看
                        </button>
                        {isDeleted(row) ? (
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => restore(row)}>
                            <RotateCcw size={13} /> 恢复
                          </button>
                        ) : (
                          <button type="button" className="btn btn--ghost btn--sm btn--danger" onClick={() => softDelete(row)}>
                            <Trash2 size={13} /> 删除
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 ? (
          <div className="admin__pager">
            <span className="admin__sub admin__pager-info">
              第 <strong>{safePage}</strong> / {pageCount} 页 · 共 {filtered.length} 条
              {pageCount > 1 ? `（本页 ${pagedRows.length} 条）` : ''}
            </span>
            <div className="admin__pager-btns">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => gotoPage(1)} disabled={safePage <= 1}>
                首页
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => gotoPage(safePage - 1)} disabled={safePage <= 1}>
                上一页
              </button>
              {pageButtons.map((n) =>
                typeof n === 'string' ? (
                  <span key={n} className="admin__pager-gap">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    className={`btn btn--sm ${n === safePage ? 'btn--accent' : 'btn--ghost'}`}
                    onClick={() => gotoPage(n)}
                    aria-current={n === safePage ? 'page' : undefined}
                  >
                    {n}
                  </button>
                )
              )}
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => gotoPage(safePage + 1)}
                disabled={safePage >= pageCount}
              >
                下一页
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => gotoPage(pageCount)}
                disabled={safePage >= pageCount}
              >
                末页
              </button>
            </div>
            <span className="admin__sub admin__pager-note">
              导出的 CSV 是当前筛选的<strong>全部 {filtered.length} 条</strong>，不只本页。
            </span>
          </div>
        ) : null}

        <section className="admin__period admin__accounts">
          <div className="admin__period-head">
            <h2>账号管理</h2>
            <button type="button" className="btn btn--ghost btn--sm" onClick={toggleAccounts}>
              {accountsOpen ? '收起' : '展开：新增登录账号 / 授权 / 删除'}
            </button>
          </div>
          <p className="admin__sub admin__period-note">
            在这里直接给同事开后台账号（邮箱 + 密码），并决定要不要给他权限。新账号默认同时授权；
            如果先建号但不授权，他能登录、但看不到任何数据，之后随时可以在这里点「授权」。
            账号攒太多了就点这一行的「删除」彻底删掉（不设黑名单，以后同一个邮箱随时能重新添加）；
            只想暂时不让他看数据，用「停用」就够了，别人随时能恢复。
          </p>

          {accountsOpen ? (
            <>
              {accountsError ? <p className="admin__error">{accountsError}</p> : null}
              {accountsMsg ? <p className="admin__ok">{accountsMsg}</p> : null}

              <form className="admin__accform" onSubmit={createAccount}>
                <label className="admin__accfield">
                  <span>登录邮箱</span>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="例如 zhangsan@qq.com"
                    autoComplete="off"
                  />
                </label>
                <label className="admin__accfield">
                  <span>初始密码</span>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="至少 8 位，可直接发给他"
                    autoComplete="off"
                  />
                </label>
                <label className="admin__acccheck">
                  <input type="checkbox" checked={newGrant} onChange={(e) => setNewGrant(e.target.checked)} />
                  立即授权（能看客户询盘）
                </label>
                <button type="submit" className="btn btn--primary btn--sm" disabled={accountsBusy}>
                  新建账号
                </button>
              </form>

              <div className="admin__period-wrap">
                <table className="admin__table admin__period-table">
                  <thead>
                    <tr>
                      <th>登录邮箱</th>
                      <th>权限</th>
                      <th>创建时间</th>
                      <th>最近登录</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((row) => (
                      <tr key={row.user_id}>
                        <td>{row.email}</td>
                        <td>
                          <span
                            className={`pill pill--${
                              row.is_owner ? 'owner' : row.granted ? 'handled' : 'deleted'
                            }`}
                          >
                            {row.is_owner ? '所有者' : row.granted ? '已授权' : '未授权'}
                          </span>
                        </td>
                        <td>{formatTime(row.created_at)}</td>
                        <td>{row.last_sign_in_at ? formatTime(row.last_sign_in_at) : '从未登录'}</td>
                        <td>
                          <div className="admin__rowbtns">
                            {row.is_owner ? (
                              <span className="admin__sub">所有者账号不能停用或删除</span>
                            ) : (
                              <>
                                {row.granted ? (
                                  <button
                                    type="button"
                                    className="btn btn--ghost btn--sm"
                                    onClick={() => setAccess(row, false)}
                                    disabled={accountsBusy}
                                  >
                                    停用
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn--ghost btn--sm"
                                    onClick={() => setAccess(row, true)}
                                    disabled={accountsBusy}
                                  >
                                    授权
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn btn--ghost btn--sm"
                                  onClick={() => resetPassword(row)}
                                  disabled={accountsBusy}
                                >
                                  重置密码
                                </button>
                                <button
                                  type="button"
                                  className="btn btn--sm btn--danger-solid"
                                  onClick={() => deleteAccount(row)}
                                  disabled={accountsBusy}
                                >
                                  删除
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      </div>

      {opened ? (
        <div className="admin__modal">
          <div className="admin__modal-scrim" onClick={() => setOpenRef(null)} role="presentation" />
          <div className="admin__modal-card">
            <header>
              <div>
                <code>{opened.ref}</code>
                <p className="admin__sub">{formatTime(opened.created_at)}</p>
              </div>
              <button type="button" className="iconbtn" onClick={() => setOpenRef(null)} aria-label="关闭">
                ×
              </button>
            </header>
            <dl className="admin__meta">
              <div>
                <dt>公司</dt>
                <dd>{opened.company || '—'}</dd>
              </div>
              <div>
                <dt>WhatsApp</dt>
                <dd>{opened.contact_name}</dd>
              </div>
              <div>
                <dt>邮箱</dt>
                <dd>
                  <a href={`mailto:${opened.email}`}>{opened.email}</a>
                </dd>
              </div>
              <div>
                <dt>国家 / 港口</dt>
                <dd>{opened.country || '—'}</dd>
              </div>
            </dl>
            {opened.message ? <p className="admin__message">“{opened.message}”</p> : null}
            <table className="admin__table">
              <thead>
                <tr>
                  <th>产品</th>
                  <th>型号</th>
                  <th>数量</th>
                  <th>单价</th>
                  <th>小计</th>
                </tr>
              </thead>
              <tbody>
                {(opened.items || []).map((item) => {
                  const link = productLink(item.product_id);
                  return (
                    <tr key={item.id}>
                      <td>
                        <span className="admin__pcell">
                          <img
                            className="admin__pthumb"
                            src={productImage(item.product_id)}
                            alt=""
                            loading="lazy"
                            onError={(event) => {
                              const img = event.currentTarget;
                              if (img.dataset.fallback) return;
                              img.dataset.fallback = '1';
                              img.src = PLACEHOLDER_IMG;
                            }}
                          />
                          {link ? (
                            <a
                              className="admin__plink"
                              href={link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`在新窗口打开：${link.label}`}
                            >
                              {item.product_name} <ExternalLink size={12} />
                            </a>
                          ) : (
                            item.product_name
                          )}
                        </span>
                      </td>
                      <td>{item.model || '—'}</td>
                      <td>{item.quantity}</td>
                      <td>{money(item.unit_price == null ? null : Number(item.unit_price))}</td>
                      <td>
                        {item.unit_price == null ? '需报价' : money(Number(item.unit_price) * item.quantity)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <AttachmentList inquiryId={opened.id} />
            <p className="admin__sub">运费不含在报价内，需与客户另行协商确定。</p>
            <div className="admin__modal-actions">
              <span className="admin__modal-status">
                当前状态：
                <span className={`pill pill--${isDeleted(opened) ? 'deleted' : opened.status}`}>
                  {isDeleted(opened) ? '已删除' : STATUS_LABEL[opened.status]}
                </span>
              </span>
              <div className="admin__rowbtns">
                {isDeleted(opened) ? (
                  <button type="button" className="btn btn--primary" onClick={() => restore(opened)}>
                    <RotateCcw size={14} /> 恢复这条询盘
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => setStatus(opened, opened.status === 'handled' ? 'new' : 'handled')}
                    >
                      标记为{opened.status === 'handled' ? '待处理' : '已处理'}
                    </button>
                    {opened.status === 'invalid' ? (
                      <button type="button" className="btn btn--ghost" onClick={() => setStatus(opened, 'new')}>
                        取消无效，改回待处理
                      </button>
                    ) : (
                      <button type="button" className="btn btn--ghost" onClick={() => setStatus(opened, 'invalid')}>
                        标记为无效订单
                      </button>
                    )}
                    <button type="button" className="btn btn--ghost btn--danger" onClick={() => softDelete(opened)}>
                      <Trash2 size={14} /> 删除
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
