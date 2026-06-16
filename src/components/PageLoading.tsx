interface PageLoadingProps {
  title?: string;
  message?: string;
}

/**
 * Branded fallback shown while a protected page is still resolving
 * auth/subscription/data. Prevents the "black screen" perception.
 */
export function PageLoading({ title, message = "불러오는 중…" }: PageLoadingProps) {
  return (
    <div className="container-mobile py-10">
      {title && <h1 className="num text-2xl text-primary">{title}</h1>}
      <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-center">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

interface PageErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function PageError({
  title = "문제가 발생했어요",
  message = "잠시 후 다시 시도해 주세요.",
  onRetry,
}: PageErrorProps) {
  return (
    <div className="container-mobile py-10">
      <h1 className="num text-2xl text-primary">{title}</h1>
      <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => (onRetry ? onRetry() : window.location.reload())}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            새로고침
          </button>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm"
          >
            뒤로가기
          </button>
        </div>
      </div>
    </div>
  );
}
