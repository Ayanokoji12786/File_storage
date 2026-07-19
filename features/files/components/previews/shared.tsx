import { FileQuestion, Loader2 } from 'lucide-react'

export function PreviewLoading() {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
    </div>
  )
}

export function PreviewMessage({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-12 text-center text-muted-foreground">
      <FileQuestion className="size-10" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
