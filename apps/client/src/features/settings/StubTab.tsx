import { Construction } from 'lucide-react'

export function StubTab({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-fg-muted">
      <Construction size={20} className="text-fg-faint" />
      <h2 className="text-[18px] font-semibold text-fg">{title}</h2>
      <p className="max-w-md text-[13px] leading-relaxed">{body}</p>
    </div>
  )
}
