import { RigbuLoader } from '@/components/brand/rigbu'

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <RigbuLoader label="Loading your learning space..." />
    </div>
  )
}
