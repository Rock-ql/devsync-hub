import { useCallback, useMemo, useRef } from 'react'
import { Bold, Code2, Heading2, Italic, Link2, List, Quote } from 'lucide-react'
import ReactMarkdown, { type Components } from 'react-markdown'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

interface MarkdownEditorProps {
  value: string
  onChange: (next: string) => void
  required?: boolean
  placeholder?: string
  components?: Components
  normalizeContent?: (content: string) => string
}

interface InsertResult {
  text: string
  selectionStart: number
  selectionEnd: number
}

const DEFAULT_PLACEHOLDER = `## 今日完成
- 完成 A 功能
- 修复 B 问题

## 明日计划
- 推进 C 需求
`

export default function MarkdownEditor({
  value,
  onChange,
  required,
  placeholder = DEFAULT_PLACEHOLDER,
  components,
  normalizeContent,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const previewContent = useMemo(() => {
    return normalizeContent ? normalizeContent(value) : value
  }, [normalizeContent, value])

  const applyInsertion = useCallback(
    (builder: (selected: string) => InsertResult) => {
      const textarea = textareaRef.current
      if (!textarea) return
      const start = textarea.selectionStart ?? 0
      const end = textarea.selectionEnd ?? 0
      const selected = value.slice(start, end)
      const inserted = builder(selected)
      const next = `${value.slice(0, start)}${inserted.text}${value.slice(end)}`
      onChange(next)
      requestAnimationFrame(() => {
        const target = textareaRef.current
        if (!target) return
        target.focus()
        target.setSelectionRange(start + inserted.selectionStart, start + inserted.selectionEnd)
      })
    },
    [onChange, value],
  )

  const insertHeading = useCallback(() => {
    applyInsertion((selected) => {
      const content = selected || '小节标题'
      const text = `## ${content}`
      return { text, selectionStart: 3, selectionEnd: 3 + content.length }
    })
  }, [applyInsertion])

  const wrapSelection = useCallback(
    (prefix: string, suffix: string, fallback: string) => {
      applyInsertion((selected) => {
        const content = selected || fallback
        const text = `${prefix}${content}${suffix}`
        return {
          text,
          selectionStart: prefix.length,
          selectionEnd: prefix.length + content.length,
        }
      })
    },
    [applyInsertion],
  )

  const insertList = useCallback(() => {
    applyInsertion((selected) => {
      if (!selected) {
        const text = '- 列表项'
        return { text, selectionStart: 2, selectionEnd: text.length }
      }
      const text = selected
        .split('\n')
        .map((line) => {
          const trimmed = line.trim()
          if (!trimmed) return '- '
          return `- ${trimmed.replace(/^[-*+]\s+/, '')}`
        })
        .join('\n')
      return { text, selectionStart: 0, selectionEnd: text.length }
    })
  }, [applyInsertion])

  const insertQuote = useCallback(() => {
    applyInsertion((selected) => {
      if (!selected) {
        const text = '> 引用内容'
        return { text, selectionStart: 2, selectionEnd: text.length }
      }
      const text = selected
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')
      return { text, selectionStart: 0, selectionEnd: text.length }
    })
  }, [applyInsertion])

  const insertCodeBlock = useCallback(() => {
    applyInsertion((selected) => {
      const content = selected || '在这里输入代码'
      const text = `\`\`\`\n${content}\n\`\`\``
      return { text, selectionStart: 4, selectionEnd: 4 + content.length }
    })
  }, [applyInsertion])

  const insertLink = useCallback(() => {
    applyInsertion((selected) => {
      const label = selected || '链接文本'
      const url = 'https://'
      const text = `[${label}](${url})`
      const selectionStart = text.indexOf(url)
      return { text, selectionStart, selectionEnd: selectionStart + url.length }
    })
  }, [applyInsertion])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!(event.metaKey || event.ctrlKey)) return
      const key = event.key.toLowerCase()
      if (key === 'b') {
        event.preventDefault()
        wrapSelection('**', '**', '粗体文本')
        return
      }
      if (key === 'i') {
        event.preventDefault()
        wrapSelection('*', '*', '斜体文本')
        return
      }
      if (key === 'k') {
        event.preventDefault()
        insertLink()
      }
    },
    [insertLink, wrapSelection],
  )

  const toolbarButtonClass = 'h-8 w-8 p-0'

  const renderEditor = (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={handleKeyDown}
      rows={18}
      required={required}
      placeholder={placeholder}
      className="min-h-[420px] resize-y font-mono text-sm"
    />
  )

  const renderPreview = (
    <div className="min-h-[420px] overflow-auto rounded-xl border border-border bg-muted/20 p-4">
      {previewContent.trim() ? (
        <div className="markdown text-sm text-foreground">
          <ReactMarkdown components={components}>{previewContent}</ReactMarkdown>
        </div>
      ) : (
        <div className="pt-2 text-sm text-muted-foreground">Markdown 预览区域</div>
      )}
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" className={toolbarButtonClass} onMouseDown={(event) => event.preventDefault()} onClick={insertHeading} aria-label="插入二级标题">
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="secondary" className={toolbarButtonClass} onMouseDown={(event) => event.preventDefault()} onClick={() => wrapSelection('**', '**', '粗体文本')} aria-label="加粗">
          <Bold className="h-4 w-4" />
        </Button>
        <Button type="button" variant="secondary" className={toolbarButtonClass} onMouseDown={(event) => event.preventDefault()} onClick={() => wrapSelection('*', '*', '斜体文本')} aria-label="斜体">
          <Italic className="h-4 w-4" />
        </Button>
        <Button type="button" variant="secondary" className={toolbarButtonClass} onMouseDown={(event) => event.preventDefault()} onClick={insertList} aria-label="插入列表">
          <List className="h-4 w-4" />
        </Button>
        <Button type="button" variant="secondary" className={toolbarButtonClass} onMouseDown={(event) => event.preventDefault()} onClick={insertQuote} aria-label="插入引用">
          <Quote className="h-4 w-4" />
        </Button>
        <Button type="button" variant="secondary" className={toolbarButtonClass} onMouseDown={(event) => event.preventDefault()} onClick={insertCodeBlock} aria-label="插入代码块">
          <Code2 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="secondary" className={toolbarButtonClass} onMouseDown={(event) => event.preventDefault()} onClick={insertLink} aria-label="插入链接">
          <Link2 className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground">快捷键: Ctrl/Cmd + B/I/K</span>
      </div>

      <div className="hidden grid-cols-2 gap-4 lg:grid">
        {renderEditor}
        {renderPreview}
      </div>

      <Tabs defaultValue="write" className="space-y-3 lg:hidden">
        <TabsList>
          <TabsTrigger value="write">编辑</TabsTrigger>
          <TabsTrigger value="preview">预览</TabsTrigger>
        </TabsList>
        <TabsContent value="write" className="mt-0">
          {renderEditor}
        </TabsContent>
        <TabsContent value="preview" className="mt-0">
          {renderPreview}
        </TabsContent>
      </Tabs>
    </div>
  )
}
