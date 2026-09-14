# DESIGN — Aoshahua Lighting 英文公司宣传站

> 主代理 canvas-design 兜底契约（canvas-designer 子代理因网络中断不可用，按 skill 规定由主代理产出完整契约）。
> 站点语言：English。类型：corporate/enterprise + B2B 产品目录 + 询盘转化。无在线支付/购物车。

## 1. Product Goal & Audience

- **目标**：把"江门源头工厂 + 自有品牌"的澳沙华照明介绍给海外买家；展示云石壁灯与水晶吊灯等核心产品；引导三类转化——① 电话/邮件询盘 ② 添加微信 ③ 跳转 1688 旺铺看全部 500+ 款并下单。
- **受众**：欧美/东北亚/中东的灯具进口商、批发商、酒店与工程采购方、室内设计师、Amazon/eBay/AliExpress 卖家（OEM/ODM 客户）。
- **可信卖点（真实数据，不编造）**：源头工厂（设计-研发-生产-销售一体化）、自有品牌 AOSHUA/澳沙华、500㎡ 自营厂房（用户口径）、10+ 年行业经验（1688 开店 2018，公司简介称创始于 1999，对外统一表述 "operating since 1999, 10+ years on 1688" 取稳妥口径 "Two decades of lighting craftsmanship"— 需保守：用 "10+ years export manufacturing experience" + 备案成立 2018 太细，统一用 "Decades of craftsmanship, officially established 2018"？过于绕。采用："Serving global buyers for over a decade"（10+ 年，符合 1688「10年」认证标）。
- 认证：CCC、ISO9000、出口备案/报关（来自其 1688 档案，页面标注为 badges，不扩展为 CE 等未证实项）。
- 合作：OEM/ODM——来图/来样加工、包工包料；支持小批量（MOQ 1–5 件起）。
- 产品体系：Crystal Chandeliers（水晶吊灯）、Marble & Stone Wall Sconces（云石壁灯）、Pendants & Ceiling Lights（吊灯/吸顶灯）、Commercial/Hotel Project Lighting（工程灯）。

## 2. Visual Direction

- 高端奢华 + 工厂可信感。参考（仅风格 inspiration，禁止复制图文/定价/品牌话语）：vorelli.co.uk —— 深色场景、产品为大主角、衬线展示字体、香槟金点缀、大留白。
- 收敛：比纯零售更"工厂主理人"气质——不堆生活场景摆拍，产品实拍 + 精准排版 + 认证徽标说话；**2026-09-08 按用户要求改为白色为底（warm ivory 暖白 + 香槟金点缀）**，页面主体为浅色，唯一深色块为页脚深棕锚点（增加层次与品牌感）。
- 关键视觉动作：Hero 用真实产品大图（旗舰水晶吊灯实拍）衬浅色底 + 金色细线框卡片；标题用衬线 display；数字/徽标区克制地使用金色。

## 3. Reference Sources

- `vendor/open-design/adapter/STATIC_POLICY.md`（静态资源权威序：policy → index → translation → upstream → 用户项目）
- `vendor/open-design/adapter/RESOURCE_INDEX.md`（craft 选择：marketing 页面 → typography/color/anti-ai-slop/laws-of-ux；premium/luxury → `luxury` 基线）
- `vendor/open-design/upstream/design-systems/luxury/DESIGN.md`
- `vendor/open-design/upstream/design-systems/luxury/tokens.css`
- `vendor/open-design/upstream/design-systems/luxury/components.html`（组件 fixture，已在 glob 确认存在；组件形态从 DESIGN.md/tokens 推导实现，未整体嵌入 HTML）
- `vendor/open-design/upstream/craft/anti-ai-slop.md`
- 线上 inspiration：`https://www.vorelli.co.uk/`（已抓取首页文本，风格 cue：奢华别墅/酒店语境、chandelier 专精、多表面处理 finish 体系、产品卡干净留白）
- 品牌数据源：用户 1688 工厂卡页 `sale.1688.com/factory/card.html?...`、旺铺 `aoshahua.1688.com`、offer `detail.1688.com/offer/808680470415.html`（AH-24622B 数据/图）

## 4. Vendor Grounding

- **基线**：`design-systems/luxury`（黑漆+香槟金 premium 调，最贴近灯具高端定位）
- **Token 来源**：`luxury/tokens.css` 的 token 名与值作为本项目 CSS 变量翻译来源（非整文件拷贝）
- **组件 fixture**：`luxury/components.html`（存在于包内，作为形态依据）
- **Anti-ai-slop 检查已应用**：不使用 Tailwind indigo/紫渐变；hero 无"trust 渐变"；功能图标一律 lucide monoline SVG(currentColor)，零 emoji；display 文本用 serif var(--font-display)；卡片采用细金色描边而非"彩色左边框圆角 AI 卡"；不虚构指标（数字仅用可验证项：10+ years / 500+ models / CCC / ISO9000 / 500㎡）；零占位文案与零占位图；外部图片全部为品牌自有 1688 CDN 实拍（无 unsplash/placehold 占位）。
- **偏差**：luxury 系统为黑底极简，本站 2026-09-08 经用户确认反转为**白色为底**（warm ivory #FAF6EE + 深金 #7E5F24 文字点缀 + 亮金 #C9A45E 填充）；保留 luxury 的衬线 display、大留白与克制装饰语言；页脚用深棕做视觉锚点；按钮直角细描边（非 pill）。

## 5. Color Tokens（CSS variables 落地）

```css
--bg:        #FAF6EE;   /* 页面暖白底 */
--bg-tint:   #F3ECDD;   /* 交替浅金米色带（Why Us） */
--surface:   #FFFFFF;   /* 卡片 */
--surface-2: #F8F2E5;
--footer-bg: #16120C;   /* 页脚深棕锚点 */
--ink:       #231A0D;   /* 标题深褐 */
--fg:        #262014;   /* 正文 */
--fg-2:      #5C513C;   /* 次级 */
--muted:     #8A7A5B;   /* 弱文本 */
--accent:    #9A7830;   /* 深金——浅底上的文字/描边 */
--accent-bright: #C9A45E; /* 亮金——按钮填充 */
--accent-hi: #B18B3E;
--line:      #E3D6B9;
--line-soft: #EFE6D2;
--focus:     0 0 0 4px rgba(154,120,48,.22);
```

## 6. Typography

- display（h1/h2/大字标）：`"Didot","Bodoni MT",Georgia,"Times New Roman",serif`，weight 400–500，letter-spacing -0.015em，line-height 0.98–1.05
- body/ui：`"Avenir Next","Segoe UI",Inter,"Helvetica Neue",Arial,sans-serif`
- eyebrow/小标签：sans 700，uppercase，letter-spacing .32em，color accent
- 字号（clamp 流体）：hero h1 clamp(40px,7vw,84px)；section h2 clamp(30px,4.4vw,56px)；lede 18–20px；body 16px/1.65

## 7. Spacing / Radii / Elevation

- 8pt 节奏；section padding: 120px desktop / 84 tablet / 60 phone（同 luxury tokens）
- 容器 max 1160px，gutter 36/24/16
- radius：卡片 6px（细金描边）、按钮 2px、徽标 pill 999
- 阴影克制：深底少阴影，用 1px var(--line) 描边 + 悬停 gold 描边；浅色区卡片用柔和投影

## 8. Components（含 data-component）

| 组件 | data-component | 说明 |
|---|---|---|
| Header（sticky，blur 深底，wordmark + nav + CTA） | site-header | 滚动后加深；移动端汉堡菜单 |
| Wordmark | brand-wordmark | 衬线 "AOSHUA" + 小字 "LIGHTING · JIANGMEN · SINCE 1999"，预留 logo.png 替换位 |
| Hero | hero-section | 左文案右产品大图（金色细线框）；eyebrow/H1/lede/双 CTA |
| Trust strip（数字徽标行） | trust-strip | 10+ yrs / 500+ models / CCC·ISO9000 / OEM·ODM / 500㎡ |
| Collection tiles | collection-tile | 3 大分类卡（图 + 名 + 一句描述 + arrow） |
| Featured products | product-card | 5 实拍产品卡（图、名称、MOQ chip、型号、询盘按钮）+ 1 张 "500+ more → 1688" CTA 卡，6 宫格 |
| Why-us（浅色区） | why-us | 6 能力项：自有品牌/源头工厂/500㎡ 产线/CCC·ISO9000/OEM·ODM/出口经验（EU·NE Asia·Middle East） |
| Process steps | process-steps | 4 步编号：Inquiry → Sample & Confirm → Production & QC → Pack & Ship |
| Contact band | contact-band | 大字号召 + Call(tel) / Email(mailto) / WeChat(copy 显示) / 1688 链接 |
| Footer | site-footer | wordmark、nav、联系块、认证行、© 2026 |
| Back-to-top | — | 可选小按钮 |

## 9. Page Structure & Responsive Rules

- 单页锚点导航：Products / Collections / Why Us / Contact；`scroll-behavior:smooth` + `scroll-margin-top:96px`
- Desktop：hero 两栏（1.05fr/0.95fr）；featured 3×2；why-us 3×2；tiles 3 列
- Tablet(≤1024)：hero 单栏堆叠（图在下），tiles 3→1 行滚/3列等宽缩小，featured 2×3
- Mobile(≤680)：gutter 16；featured/why/tiles 单列；CTA 按钮全宽；Header 汉堡菜单展开纵向；字号按 clamp 收敛
- 触控目标 ≥44px；focus-visible 用 --focus 金色环

## 10. Interaction & Motion

- hover：product-card 图片轻微 scale(1.03) 300ms + 底部金色细线从左展开；按钮 hover 金色填充/描边反转；tile hover 金色箭头右移
- 入场：IntersectionObserver 渐显上移（`[data-reveal]`，translateY(14px)→0，600ms ease，stagger 80ms，prefers-reduced-motion 关闭）
- 数字暂不做 count-up（避免花哨）；锚点平滑滚动；移动端菜单 220ms ease

## 11. Image Manifest（全部为品牌自有 1688 CDN 实拍，external 直用，不下载）

> 实现前须 curl HEAD 验证可达。⚠️ 主推 4 款缩略图↔名称对应为 1688 首页 DOM 顺序推断，交付前请用户核对，可随时在 data 文件换 URL。

| Local/URL | Source | Mode | Usage |
|---|---|---|---|
| https://cbu01.alicdn.com/img/ibank/O1CN01fcRc5w1qlXaSjsdtV_!!3322995536-0-cib.jpg | 品牌1688 AH-24622B 主图 | external | Hero 大图（旗舰水晶吊灯） |
| https://cbu01.alicdn.com/img/ibank/O1CN01sAVW7w1qlXaJawBXA_!!3322995536-0-cib.jpg | 同上款副图 | external | Featured 卡 AH-24622B |
| https://cbu01.alicdn.com/img/ibank/O1CN01GVBz8R1qlXaSIGJCR_!!3322995536-0-cib.jpg | 同上款另一角度 | external | Collection tile — Crystal Chandeliers |
| https://cbu01.alicdn.com/img/ibank/O1CN01fWCk9y1Bs2kXEDcNK_!!0-0-cib.jpg_Q75.jpg_.webp | 1688首页 主推①（推断：云石壁灯 wandleuchte） | external | Featured 卡 — Marble Wall Sconce（核对项） |
| https://cbu01.alicdn.com/img/ibank/O1CN01yGHlTH1Bs2kXEHEwE_!!0-0-cib.jpg_Q75.jpg_.webp | 1688首页 主推②（推断：简约铁艺吊灯） | external | Featured 卡 — Iron Pendant（核对项） |
| https://cbu01.alicdn.com/img/ibank/O1CN015uh3NL1Bs2kWId4QN_!!0-0-cib.jpg_Q75.jpg_.webp | 1688首页 主推③（推断：工程客厅吊灯） | external | Featured 卡 — Project Chandelier（核对项） |
| https://cbu01.alicdn.com/img/ibank/O1CN01SpQiLj1Bs2kXzEWiX_!!0-0-cib.jpg_Q75.jpg_.webp | 1688首页 主推④（推断：环形吊灯） | external | Featured 卡 — Ring Chandelier（核对项） |
| https://cbu01.alicdn.com/img/ibank/O1CN01ukKVw11Bs2kZws8vG_!!0-0-cib.jpg_Q75.jpg_.webp | 品牌1688 店铺图 | external | Collection tile — Marble & Stone Wall Sconces |
| https://cbu01.alicdn.com/img/ibank/O1CN01Q0i0WE1Bs2kQRzLJi_!!0-0-cib.jpg_Q75.jpg_.webp | 品牌1688 店铺图 | external | Collection tile — Pendants & Ceiling |
| public/assets/images/logo.png | 用户 PNG（当前未落盘） | local（预留） | Header/Footer 官方 Logo 替换位；未提供前用 wordmark 字标 |

- imageGenerate：0 张（工厂实景无真实素材，不虚构工厂照片；视觉完整性由产品实拍 + 排版承担——anti-slop 允许真实主题用真实图）。
- 禁止未授权第三方图床/占位图。

## 12. Content Notes（文案基调样例）

- Hero H1：`Crystal Chandeliers & Marble Wall Sconces, Direct From Our Jiangmen Workshop`
- Hero lede：源头工厂/自有品牌/CCC·ISO9000/OEM·ODM，From prototype to bulk order。
- Why-us 标题方向：`A Source Factory Behind an Own Brand`
- Contact H2：`Let's Light Your Next Project`
- CTA 文案：Get a Quotation / Browse 500+ Models on 1688 / Call Our Export Team
- 联系：Phone +86 135 5672 1857（tel:+8613556721857）、Email 2596607017@qq.com、WeChat ID: aoshahua lighting、1688 旺铺 https://aoshahua.1688.com/ 、地址 3rd Floor, No.1 Yangshan Avenue, Jianghai District, Jiangmen, Guangdong, China（其 1688 档案地址）

## 13. Verification Checklist

- [ ] 生产构建通过（npm run build）
- [ ] 预览桌面+移动视口非空、无横向溢出、CTA 可达
- [ ] 无占位文案/占位图/未授权图床；所有图片为品牌自有 URL 且可达
- [ ] 英文语言一致；数字仅可验证项
