import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-start justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">That address is not part of Rigbu LMS.</p>
      <Link href="/" className="rounded-md bg-foreground px-4 py-2 text-sm text-background">
        Go home
      </Link>
    </main>
  )
}
