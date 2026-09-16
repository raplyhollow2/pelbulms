'use client'

import { Award, Download, ExternalLink, Loader2, PartyPopper } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseTitle?: string | null
  certificateUrl?: string | null
  issuing?: boolean
  claimHref: string
  onDownload: () => void
}

/**
 * Shown when a learner reaches 100% course progress.
 */
export function CourseCompletionDialog({
  open,
  onOpenChange,
  courseTitle,
  certificateUrl,
  issuing = false,
  claimHref,
  onDownload,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader className="items-center text-center sm:items-center">
          <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-bhutan-yellow/20">
            <PartyPopper className="h-8 w-8 text-bhutan-orange" aria-hidden />
          </div>
          <DialogTitle className="text-xl sm:text-2xl">Congratulations!</DialogTitle>
          <DialogDescription className="text-center text-base">
            You have completed
            {courseTitle ? (
              <>
                {' '}
                <span className="font-medium text-foreground">{courseTitle}</span>
              </>
            ) : (
              ' this course'
            )}
            . Your certificate of completion is ready to claim.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
          <Award className="mx-auto mb-2 h-5 w-5 text-bhutan-yellow" />
          Download your PDF certificate, or open the claim page to verify and save it anytime.
        </div>

        <DialogFooter className="gap-2 sm:flex-col sm:space-x-0">
          <Button
            className="min-h-11 w-full bg-bhutan-yellow text-black hover:bg-bhutan-orange"
            disabled={issuing}
            onClick={onDownload}
          >
            {issuing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Preparing certificate…
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                {certificateUrl ? 'Download certificate' : 'Get certificate'}
              </>
            )}
          </Button>
          <Button
            variant="outline"
            className="min-h-11 w-full"
            onClick={() => {
              onOpenChange(false)
              window.location.href = claimHref
            }}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Go to certificate claim page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
