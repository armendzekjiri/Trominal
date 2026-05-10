import {
  ArrowRight,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  File,
  Filter,
  Folder,
  Key,
  Lock,
  Monitor,
  MoreHorizontal,
  Network,
  Play,
  Plus,
  Power,
  RefreshCw,
  Search,
  Server,
  Settings,
  Shield,
  Sparkles,
  SplitSquareHorizontal,
  Tag,
  Terminal,
  Unlock,
  Upload,
  X,
  Zap,
  Check,
  type LucideIcon,
} from 'lucide-react'

const map: Record<string, LucideIcon> = {
  arrow_right: ArrowRight,
  arrow_up_down: ArrowUpDown,
  bolt: Zap,
  check: Check,
  chevron_down: ChevronDown,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  code: Code2,
  copy: Copy,
  file: File,
  filter: Filter,
  folder: Folder,
  key: Key,
  lock: Lock,
  monitor: Monitor,
  more: MoreHorizontal,
  play: Play,
  plus: Plus,
  power: Power,
  refresh: RefreshCw,
  search: Search,
  server: Server,
  settings: Settings,
  shield: Shield,
  sparkles: Sparkles,
  split: SplitSquareHorizontal,
  tag: Tag,
  terminal: Terminal,
  tunnel: Network,
  unlock: Unlock,
  upload: Upload,
  x: X,
}

export type MobileIconName = keyof typeof map | string

export function MobileIcon({
  name,
  size = 16,
  color,
  strokeWidth = 1.6,
}: {
  name: MobileIconName
  size?: number
  color?: string
  strokeWidth?: number
}) {
  const Cmp = map[name] ?? MoreHorizontal
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} />
}
