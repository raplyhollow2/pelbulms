import { BookOpen, Loader2 } from 'lucide-react'

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-yellow-50 via-orange-50 to-white dark:from-gray-900 dark:via-gray-900 dark:to-black">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-bhutan-yellow to-bhutan-orange shadow-xl shadow-bhutan-orange/30">
        <span className="absolute -inset-1.5 rounded-[1.75rem] border-2 border-bhutan-yellow/40 animate-ping" />
        <BookOpen className="h-10 w-10 text-white" />
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="bg-gradient-to-r from-bhutan-yellow to-bhutan-orange bg-clip-text text-lg font-bold text-transparent">
          Pelbu LMS
        </span>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your learning space...
        </div>
      </div>
    </div>
  )
}
