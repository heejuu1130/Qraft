type ErrorLike = {
  code?: unknown
  message?: unknown
  status?: unknown
}

const toErrorDetails = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    }
  }

  if (error && typeof error === "object") {
    const errorLike = error as ErrorLike

    return {
      code: typeof errorLike.code === "string" ? errorLike.code : undefined,
      message: typeof errorLike.message === "string" ? errorLike.message : undefined,
      status: typeof errorLike.status === "number" ? errorLike.status : undefined,
    }
  }

  return {
    message: typeof error === "string" ? error : "Unknown client error",
  }
}

export function logClientError(context: string, error: unknown) {
  if (process.env.NODE_ENV === "production") return

  console.warn(`[qraft] ${context}`, toErrorDetails(error))
}
