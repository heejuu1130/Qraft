const persistentQuestionDataPrefixes = [
  "qraft:question-history:",
  "qraft:saved-questions:",
]

const transientQuestionDataKeys = [
  "qraft:current-result",
  "qraft:pending-save",
]

const removeMatchingKeys = (storage: Storage, shouldRemove: (key: string) => boolean) => {
  const keysToRemove: string[] = []

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)

    if (key && shouldRemove(key)) {
      keysToRemove.push(key)
    }
  }

  keysToRemove.forEach((key) => storage.removeItem(key))
}

export function clearStoredQuestionData() {
  if (typeof window === "undefined") return

  removeMatchingKeys(window.localStorage, (key) =>
    persistentQuestionDataPrefixes.some((prefix) => key.startsWith(prefix))
  )

  removeMatchingKeys(window.sessionStorage, (key) => transientQuestionDataKeys.includes(key))
}
