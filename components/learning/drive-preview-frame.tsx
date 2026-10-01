type DrivePreviewFrameProps = {
  src: string
  title: string
  className?: string
}

/** Drive's preview UI opens the file on drive.google.com. Popups are refused,
 * and the top-right control is covered because it cannot be styled from here. */
const DRIVE_SANDBOX =
  'allow-scripts allow-same-origin allow-presentation allow-forms'

export function DrivePreviewFrame({ src, title, className }: DrivePreviewFrameProps) {
  return (
    <>
      <iframe
        src={src}
        className={className}
        referrerPolicy="strict-origin-when-cross-origin"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        sandbox={DRIVE_SANDBOX}
        title={title}
      />
      <div aria-hidden className="absolute top-0 right-0 z-30 h-16 w-16 bg-black" />
    </>
  )
}
