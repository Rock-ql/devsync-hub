# Minimalist Modern 设计系统改造实施计划

> **对于 Claude：** 必需的子技能：使用 superpowers:executing-plans 按任务逐步实施此计划。

**目标：** 在 devSync Hub 前端全站落地 Minimalist Modern 设计系统，统一设计令牌、基础组件与页面布局，形成可维护、可扩展的视觉体系。

**架构：** 以 CSS 变量承载设计令牌（颜色、字体、圆角、阴影），Tailwind 负责语义化类与动效；抽象 Button/Card/Input/Badge/Dialog/Tabs/SectionLabel 等基础组件并统一调用；逐页替换为新组件与新布局，确保一致性与可用性。

**技术栈：** React 18、TypeScript、Vite、Tailwind CSS、class-variance-authority、tailwind-merge、Radix UI、framer-motion（新增）。

---

**说明：**
- 当前项目无自动化测试框架，验证以 `npm run lint` + `npm run build` + 手动页面验收为准。
- 不自动提交，计划中的提交命令由执行者手动运行。
- 技能引用：@writing-plans

### 任务 1: 设计令牌与全局样式落地

**文件：**
- 修改：`frontend/src/index.css`
- 修改：`frontend/tailwind.config.js`
- 修改：`frontend/index.html`
- 修改：`frontend/package.json`
- 测试：`frontend`（`npm run lint` / `npm run build`）

**步骤 1: 更新 CSS 变量与全局基础样式**

```css
:root {
  --background: 0 0% 98%;
  --foreground: 222 47% 11%;
  --card: 0 0% 100%;
  --card-foreground: 222 47% 11%;
  --muted: 210 40% 96%;
  --muted-foreground: 215 16% 47%;
  --accent: 220 100% 50%;
  --accent-secondary: 223 100% 65%;
  --accent-foreground: 0 0% 100%;
  --border: 214 32% 91%;
  --ring: 220 100% 50%;
  --radius: 0.75rem;
  --font-sans: "Inter", system-ui, sans-serif;
  --font-display: "Calistoga", Georgia, serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}

body { @apply bg-background text-foreground font-sans; }
h1, h2 { font-family: var(--font-display); }

.gradient-text {
  background: linear-gradient(135deg, #0052FF, #4D7CFF);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.gradient-underline {
  position: absolute;
  bottom: -0.25rem;
  left: 0;
  height: 0.75rem;
  width: 100%;
  border-radius: 0.125rem;
  background: linear-gradient(to right, rgba(0, 82, 255, 0.15), rgba(77, 124, 255, 0.1));
}

.dot-pattern {
  background-image: radial-gradient(circle, rgba(255,255,255,0.35) 1px, transparent 1px);
  background-size: 32px 32px;
  opacity: 0.35;
}
```

**步骤 2: 更新 Tailwind 主题扩展（字体、阴影、动画）**

```js
extend: {
  fontFamily: {
    sans: ['var(--font-sans)'],
    display: ['var(--font-display)'],
    mono: ['var(--font-mono)'],
  },
  colors: {
    'accent-secondary': 'hsl(var(--accent-secondary))',
  },
  boxShadow: {
    sm: '0 1px 3px rgba(0,0,0,0.06)',
    md: '0 4px 6px rgba(0,0,0,0.07)',
    lg: '0 10px 15px rgba(0,0,0,0.08)',
    xl: '0 20px 25px rgba(0,0,0,0.1)',
    'accent': '0 4px 14px rgba(0,82,255,0.25)',
    'accent-lg': '0 8px 24px rgba(0,82,255,0.35)',
  },
  keyframes: {
    'float-slow': { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
    'spin-slower': { to: { transform: 'rotate(360deg)' } },
    'pulse-dot': { '0%,100%': { transform: 'scale(1)', opacity: 1 }, '50%': { transform: 'scale(1.3)', opacity: 0.7 } },
  },
  animation: {
    'float-slow': 'float-slow 5s ease-in-out infinite',
    'spin-slower': 'spin-slower 60s linear infinite',
    'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
  },
}
```

**步骤 3: 引入字体与新增动效依赖**

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Calistoga&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

```json
"dependencies": {
  "framer-motion": "^11.0.0"
}
```

**步骤 4: 运行验证**

运行：`npm run lint`、`npm run build`  
预期：无 ESLint 报错，构建成功。

**步骤 5: 提交（手动）**

```bash
git add frontend/src/index.css frontend/tailwind.config.js frontend/index.html frontend/package.json
git commit -m "前端：落地 Minimalist Modern 设计令牌与字体"
```

### 任务 2: 基础组件库（Button/Card/Input/Badge/Dialog/Tabs）

**文件：**
- 创建：`frontend/src/components/ui/button.tsx`
- 创建：`frontend/src/components/ui/card.tsx`
- 创建：`frontend/src/components/ui/input.tsx`
- 创建：`frontend/src/components/ui/textarea.tsx`
- 创建：`frontend/src/components/ui/select.tsx`
- 创建：`frontend/src/components/ui/label.tsx`
- 创建：`frontend/src/components/ui/badge.tsx`
- 创建：`frontend/src/components/ui/section-label.tsx`
- 创建：`frontend/src/components/ui/dialog.tsx`
- 创建：`frontend/src/components/ui/tabs.tsx`
- 测试：`frontend`（`npm run lint`）

**步骤 1: Button（主/次/幽灵）与交互**

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-gradient-to-r from-[hsl(var(--accent))] to-[hsl(var(--accent-secondary))] text-white shadow-sm hover:shadow-accent hover:-translate-y-0.5",
        secondary: "border border-border bg-transparent text-foreground hover:bg-muted hover:border-[hsl(var(--accent))]/30",
        ghost: "text-muted-foreground hover:text-foreground hover:bg-muted/60",
      },
      size: {
        sm: "h-10 px-4",
        md: "h-12 px-5",
        lg: "h-14 px-6",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
)
```

**步骤 2: Card / Badge / SectionLabel**

```tsx
export function SectionLabel({ children }) {
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/5 px-5 py-2">
      <span className="h-2 w-2 rounded-full bg-[hsl(var(--accent))] animate-pulse-dot" />
      <span className="font-mono text-xs uppercase tracking-[0.15em] text-[hsl(var(--accent))]">{children}</span>
    </div>
  )
}
```

**步骤 3: Input / Textarea / Select / Label**

```tsx
const base = "h-12 w-full rounded-xl border border-border bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
```

**步骤 4: Dialog / Tabs（Radix 封装）**

```tsx
<DialogContent className="rounded-2xl border border-border bg-card p-6 shadow-xl" />
<TabsTrigger className="data-[state=active]:text-[hsl(var(--accent))] data-[state=active]:border-[hsl(var(--accent))]" />
```

**步骤 5: 运行验证与提交（手动）**

```bash
npm run lint
git add frontend/src/components/ui
git commit -m "前端：新增基础 UI 组件库"
```

### 任务 3: 应用壳与导航布局重构

**文件：**
- 修改：`frontend/src/components/Layout.tsx`
- 可能创建：`frontend/src/components/layout/SidebarNav.tsx`
- 测试：`frontend`（`npm run lint`）

**步骤 1: 侧边栏与品牌区改造**

```tsx
<aside className="fixed inset-y-0 left-0 w-72 bg-card/80 backdrop-blur border-r border-border">
  <div className="flex items-center h-16 px-6 border-b border-border">
    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[hsl(var(--accent))] to-[hsl(var(--accent-secondary))] shadow-accent" />
    <span className="ml-3 text-lg font-semibold font-display">DevSync Hub</span>
  </div>
</aside>
```

**步骤 2: 导航项风格统一**

```tsx
const itemBase = "flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all"
const active = "bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] shadow-sm"
const idle = "text-muted-foreground hover:text-foreground hover:bg-muted/60"
```

**步骤 3: 运行验证与提交（手动）**

```bash
npm run lint
git add frontend/src/components/Layout.tsx
git commit -m "前端：重构应用壳与导航布局"
```

### 任务 4: Dashboard 页面重构（含反差区与动效）

**文件：**
- 修改：`frontend/src/pages/Dashboard.tsx`
- 测试：`frontend`（`npm run lint`）

**步骤 1: 顶部 Hero + 渐变标题 + 右侧装饰图**

```tsx
<div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
  <div>
    <SectionLabel>OVERVIEW</SectionLabel>
    <h1 className="mt-6 text-4xl md:text-5xl font-display leading-[1.1]">
      项目进度 <span className="gradient-text">一目了然</span>
    </h1>
    <p className="mt-4 text-muted-foreground text-lg">聚焦关键指标与风险，让团队节奏更清晰。</p>
  </div>
  <HeroGraphic className="hidden lg:block" />
</div>
```

**步骤 2: 统计卡片与渐变图标**

```tsx
<Card className="group hover:shadow-xl transition-all">
  <div className="flex items-center gap-4">
    <div className="rounded-xl p-3 bg-gradient-to-br from-[hsl(var(--accent))] to-[hsl(var(--accent-secondary))] shadow-accent">
      <Icon className="h-6 w-6 text-white" />
    </div>
    ...
  </div>
</Card>
```

**步骤 3: 反差区块（深色背景 + 点阵纹理）**

```tsx
<section className="rounded-3xl bg-foreground text-background p-8 relative overflow-hidden">
  <div className="absolute inset-0 dot-pattern" />
  <div className="relative">...</div>
</section>
```

**步骤 4: 运行验证与提交（手动）**

```bash
npm run lint
git add frontend/src/pages/Dashboard.tsx
git commit -m "前端：仪表盘页面 Minimalist Modern 改造"
```

### 任务 5: Projects 页面重构

**文件：**
- 修改：`frontend/src/pages/Projects.tsx`
- 测试：`frontend`（`npm run lint`）

**步骤 1: 页面头部与按钮统一**

```tsx
<SectionLabel>PROJECTS</SectionLabel>
<Button variant="primary"><Plus className="h-4 w-4" />新增项目</Button>
```

**步骤 2: 卡片列表与操作区样式统一**

```tsx
<Card className="cursor-pointer hover:shadow-xl transition-all">
  <Badge variant="outline">GitLab</Badge>
</Card>
```

**步骤 3: 弹窗改为 Dialog + 表单组件**

```tsx
<Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
  <DialogContent>
    <Label>项目名称</Label>
    <Input ... />
  </DialogContent>
</Dialog>
```

**步骤 4: 运行验证与提交（手动）**

```bash
npm run lint
git add frontend/src/pages/Projects.tsx
git commit -m "前端：项目管理页面改造"
```

### 任务 6: Iterations 页面重构

**文件：**
- 修改：`frontend/src/pages/Iterations.tsx`
- 测试：`frontend`（`npm run lint`）

**步骤 1: 头部与按钮统一**
```tsx
<SectionLabel>ITERATIONS</SectionLabel>
<Button variant="primary">新增迭代</Button>
```

**步骤 2: 表格样式与状态标签统一**

```tsx
<Badge variant="soft" tone="success">已上线</Badge>
<Select className="h-10" ... />
```

**步骤 3: 弹窗改为 Dialog + 表单组件**

```tsx
<DialogContent className="max-w-md">...</DialogContent>
```

**步骤 4: 运行验证与提交（手动）**

```bash
npm run lint
git add frontend/src/pages/Iterations.tsx
git commit -m "前端：迭代管理页面改造"
```

### 任务 7: SQL 管理页面重构

**文件：**
- 修改：`frontend/src/pages/SqlManagement.tsx`
- 测试：`frontend`（`npm run lint`）

**步骤 1: 筛选器与按钮统一**
```tsx
<Select ... />
<Button variant="secondary">新增 SQL</Button>
```

**步骤 2: 列表卡片与状态标签统一**
```tsx
<Card>
  <Badge variant="soft" tone={sql.status === 'pending' ? 'warning' : 'success'}>{sql.statusDesc}</Badge>
</Card>
```

**步骤 3: 弹窗改为 Dialog + 表单组件**
```tsx
<Textarea className="font-mono" rows={8} />
```

**步骤 4: 运行验证与提交（手动）**

```bash
npm run lint
git add frontend/src/pages/SqlManagement.tsx
git commit -m "前端：SQL 管理页面改造"
```

### 任务 8: Reports 页面重构

**文件：**
- 修改：`frontend/src/pages/Reports.tsx`
- 修改：`frontend/src/index.css`（新增 markdown 细粒度样式）
- 测试：`frontend`（`npm run lint`）

**步骤 1: 列表与详情区域统一为卡片体系**
```tsx
<Card>
  <CardHeader>历史报告</CardHeader>
  <CardContent>...</CardContent>
</Card>
```

**步骤 2: Markdown 样式统一**
```css
.markdown h2 { @apply text-xl font-semibold text-foreground mt-6; }
.markdown p { @apply text-muted-foreground leading-7; }
```

**步骤 3: 弹窗改为 Dialog**
```tsx
<DialogContent className="max-w-2xl">...</DialogContent>
```

**步骤 4: 运行验证与提交（手动）**
```bash
npm run lint
git add frontend/src/pages/Reports.tsx frontend/src/index.css
git commit -m "前端：日报周报页面改造"
```

### 任务 9: Settings 页面重构

**文件：**
- 修改：`frontend/src/pages/Settings.tsx`
- 测试：`frontend`（`npm run lint`）

**步骤 1: Tabs 替换自定义标签页**
```tsx
<Tabs defaultValue="general">
  <TabsList>
    <TabsTrigger value="general">基础设置</TabsTrigger>
  </TabsList>
  <TabsContent value="general">...</TabsContent>
</Tabs>
```

**步骤 2: 表单与按钮统一**
```tsx
<Label>API Base URL</Label>
<Input placeholder="https://api.deepseek.com" />
<Button variant="primary">保存设置</Button>
```

**步骤 3: 运行验证与提交（手动）**
```bash
npm run lint
git add frontend/src/pages/Settings.tsx
git commit -m "前端：系统设置页面改造"
```

### 任务 10: 全站验收与收尾

**文件：**
- 测试：`frontend`

**步骤 1: 全量构建与手动验收**
```bash
npm run lint
npm run build
```

**步骤 2: 手动验收清单**
```text
- 字体：标题使用 Calistoga，正文使用 Inter，标签使用 JetBrains Mono
- 颜色：主按钮、重点文字与图标使用 Electric Blue 渐变
- 反差区块：至少一个深色反差区，点阵纹理可见但不过度
- 动效：按钮 hover 上浮、浮动卡片与慢速旋转存在且不刺眼
- 响应式：移动端单列、CTA/表单可触达、触控高度 ≥ 44px
```

**步骤 3: 提交（手动）**
```bash
git add frontend
git commit -m "前端：全站 Minimalist Modern 设计系统改造完成"
```
