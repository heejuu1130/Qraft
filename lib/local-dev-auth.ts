export const localDevAuthStorageKey = "qraft:local-dev-auth"
export const localDevUserId = "local-dev-user"

export const isLocalDevAuthEnabled = () => process.env.NODE_ENV === "development"

export const isLocalDevUser = (user?: { id?: string } | null) =>
  isLocalDevAuthEnabled() && user?.id === localDevUserId
