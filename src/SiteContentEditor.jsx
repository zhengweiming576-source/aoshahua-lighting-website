import React, { useEffect, useMemo, useState } from 'react';
import { Check, Eye, LogOut, Save, RefreshCw } from 'lucide-react';
import { supabase } from './lib/supabase';
import { applyContent, contentSnapshot, STATIC_CONTENT } from './data';

const SECTIONS = [
  ['catalog', '首页主视觉'],
  ['contact', '联系方式'],
  ['announcement', '顶部公告'],
  ['hero', '轮播文案'],
  ['products', '产品目录'],
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function Field({ label, value, onChange, multiline = false, hint = '' }) {
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <label className="content-editor__field">
      <span>{label}</span>
      <Tag value={value ?? ''} onChange={(event) => onChange(event.target.value)} rows={multiline ? 4 : undefined} />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function EditorLogin({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signIn(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
    else onSignedIn(data.session);
    setBusy(false);
  }

  return (
    <main className="content-editor content-editor--login">
      <div className="content-editor__login-card">
        <p className="content-editor__kicker">AOSHAHUA LIGHTING</p>
        <h1>网站编辑后台</h1>
        <p className="content-editor__muted">登录后修改网站内容，保存后刷新前台即可看到最新版本。</p>
        <form onSubmit={signIn}>
          <Field label="邮箱" value={email} onChange={setEmail} />
          <Field label="密码" value={password} onChange={setPassword} />
          {error ? <p className="content-editor__error">{error}</p> : null}
          <button className="content-editor__primary" type="submit" disabled={busy || !supabase}>
            {busy ? '登录中…' : '登录编辑'}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function SiteContentEditor() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [content, setContent] = useState(() => clone(contentSnapshot()));
  const [active, setActive] = useState('catalog');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');

  useEffect(() => {
    if (!supabase) { setChecking(false); return undefined; }
    let mounted = true;
    (async () => {
      const { data: { session: current } } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(current);
      if (!current) { setChecking(false); return; }
      const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin');
      if (adminError || !isAdmin) {
        setError(adminError?.message || '这个账号还没有网站后台权限。');
        setChecking(false);
        return;
      }
      setAuthorized(true);
      const { data, error: loadError } = await supabase.from('site_content').select('content, updated_at').eq('id', 'main').maybeSingle();
      if (loadError) setError(`内容表还未启用：${loadError.message}`);
      if (data?.content) {
        const next = clone(data.content);
        applyContent(next);
        setContent(next);
        setUpdatedAt(data.updated_at || '');
      }
      setChecking(false);
    })();
    return () => { mounted = false; };
  }, []);

  const activeLabel = useMemo(() => SECTIONS.find(([key]) => key === active)?.[1] || '', [active]);

  function update(path, value) {
    setContent((current) => {
      const next = clone(current);
      let target = next;
      path.slice(0, -1).forEach((key) => { target = target[key]; });
      target[path[path.length - 1]] = value;
      return next;
    });
    setMessage('');
  }

  function updateProduct(index, key, value) {
    setContent((current) => {
      const next = clone(current);
      next.PRODUCTS[index][key] = value;
      return next;
    });
    setMessage('');
  }

  async function save() {
    if (!supabase || !authorized) return;
    setBusy(true); setError(''); setMessage('');
    const { data, error: saveError } = await supabase.from('site_content').upsert({ id: 'main', content, updated_by: session?.user?.id }, { onConflict: 'id' }).select('updated_at').single();
    if (saveError) setError(`保存失败：${saveError.message}`);
    else {
      applyContent(content);
      setUpdatedAt(data?.updated_at || new Date().toISOString());
      setMessage('已保存。打开前台并刷新，就能看到新内容。');
    }
    setBusy(false);
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setSession(null); setAuthorized(false);
  }

  if (checking) return <main className="content-editor"><p className="content-editor__loading">正在检查登录状态…</p></main>;
  if (!session) return <EditorLogin onSignedIn={(next) => { setSession(next); window.location.reload(); }} />;
  if (!authorized) return <main className="content-editor"><div className="content-editor__notice"><h1>没有编辑权限</h1><p>{error || '请让网站所有者在后台授权这个账号。'}</p></div></main>;

  return (
    <main className="content-editor">
      <header className="content-editor__header">
        <div><p className="content-editor__kicker">AOSHAHUA LIGHTING</p><h1>网站编辑后台</h1></div>
        <div className="content-editor__actions">
          <a href="/" target="_blank" rel="noreferrer" className="content-editor__ghost"><Eye size={16} /> 查看前台</a>
          <button type="button" className="content-editor__ghost" onClick={signOut}><LogOut size={16} /> 退出</button>
          <button type="button" className="content-editor__primary content-editor__save" onClick={save} disabled={busy}><Save size={16} /> {busy ? '保存中…' : '保存更改'}</button>
        </div>
      </header>
      <div className="content-editor__layout">
        <nav className="content-editor__nav" aria-label="编辑栏目">
          {SECTIONS.map(([key, label]) => <button key={key} type="button" className={active === key ? 'is-active' : ''} onClick={() => setActive(key)}>{label}</button>)}
        </nav>
        <section className="content-editor__panel">
          <div className="content-editor__panel-head"><div><p className="content-editor__kicker">EDIT</p><h2>{activeLabel}</h2></div><span className="content-editor__saved">{updatedAt ? `最近保存：${new Date(updatedAt).toLocaleString('zh-CN')}` : '尚未保存线上版本'}</span></div>
          {active === 'catalog' ? <>
            <Field label="小标题" value={content.CATALOG.eyebrow} onChange={(v) => update(['CATALOG', 'eyebrow'], v)} />
            <Field label="主标题" value={content.CATALOG.title} onChange={(v) => update(['CATALOG', 'title'], v)} multiline />
            <Field label="介绍文字" value={content.CATALOG.lede} onChange={(v) => update(['CATALOG', 'lede'], v)} multiline />
            <Field label="主按钮文字" value={content.CATALOG.ctaPrimaryLabel} onChange={(v) => update(['CATALOG', 'ctaPrimaryLabel'], v)} />
            <Field label="次按钮文字" value={content.CATALOG.ctaSecondaryLabel} onChange={(v) => update(['CATALOG', 'ctaSecondaryLabel'], v)} />
            <Field label="主视觉图片路径" value={content.CATALOG.image} onChange={(v) => update(['CATALOG', 'image'], v)} hint="可填站内 /assets/... 路径。" />
          </> : null}
          {active === 'announcement' ? <Field label="顶部公告" value={content.ANNOUNCEMENT} onChange={(v) => update(['ANNOUNCEMENT'], v)} multiline /> : null}
          {active === 'contact' ? <>
            <Field label="电话" value={content.CONTACT.phoneDisplay} onChange={(v) => update(['CONTACT', 'phoneDisplay'], v)} />
            <Field label="WhatsApp" value={content.CONTACT.whatsapp} onChange={(v) => update(['CONTACT', 'whatsapp'], v)} />
            <Field label="邮箱" value={content.CONTACT.email} onChange={(v) => update(['CONTACT', 'email'], v)} />
            <Field label="地址第一行" value={content.CONTACT.addressLine1} onChange={(v) => update(['CONTACT', 'addressLine1'], v)} />
            <Field label="地址第二行" value={content.CONTACT.addressLine2} onChange={(v) => update(['CONTACT', 'addressLine2'], v)} />
          </> : null}
          {active === 'hero' ? content.HERO_SLIDES.map((slide, index) => <div className="content-editor__group" key={index}><h3>轮播 {index + 1}</h3><Field label="小标题" value={slide.eyebrow} onChange={(v) => update(['HERO_SLIDES', index, 'eyebrow'], v)} /><Field label="标题" value={slide.title} onChange={(v) => update(['HERO_SLIDES', index, 'title'], v)} multiline /><Field label="介绍" value={slide.lede} onChange={(v) => update(['HERO_SLIDES', index, 'lede'], v)} multiline /><Field label="图片路径" value={slide.image} onChange={(v) => update(['HERO_SLIDES', index, 'image'], v)} /></div>) : null}
          {active === 'products' ? content.PRODUCTS.map((product, index) => <div className="content-editor__product" key={product.id || index}><div className="content-editor__product-img">{product.image ? <img src={product.image} alt="" /> : null}</div><div className="content-editor__product-fields"><h3>{product.name || `产品 ${index + 1}`}</h3><Field label="产品名称" value={product.name} onChange={(v) => updateProduct(index, 'name', v)} /><Field label="型号" value={product.model || ''} onChange={(v) => updateProduct(index, 'model', v)} /><Field label="简介" value={product.summary} onChange={(v) => updateProduct(index, 'summary', v)} multiline /><Field label="主图路径" value={product.image} onChange={(v) => updateProduct(index, 'image', v)} /></div></div>) : null}
          {error ? <p className="content-editor__error">{error}</p> : null}
          {message ? <p className="content-editor__success"><Check size={16} /> {message}</p> : null}
          <button type="button" className="content-editor__primary content-editor__bottom-save" onClick={save} disabled={busy}><Save size={16} /> {busy ? '保存中…' : '保存更改'}</button>
        </section>
      </div>
    </main>
  );
}
