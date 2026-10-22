export async function fetchAvailableWorkspaces({
  signal,
} = {}) {
  const response = await fetch(
    '/api/auth/workspaces',
    {
      signal,
      cache: 'no-store',
    }
  )

  const body = await response.json()

  if (!response.ok) {
    const error = new Error(
      body?.error?.message ||
        'Nije moguće učitati dostupne salone.'
    )

    error.code =
      body?.error?.code ||
      'WORKSPACES_LOAD_FAILED'

    error.statusCode = response.status

    throw error
  }

  const data = body?.data

  if (
    data?.authenticated !== true ||
    !data?.user?.id ||
    data.user.active !== true ||
    !Array.isArray(data.workspaces)
  ) {
    throw new Error(
      'Poslužitelj nije vratio valjan popis salona.'
    )
  }

  for (const workspace of data.workspaces) {
    if (
      !workspace?.salon?.id ||
      !workspace.salon.name ||
      !workspace.salon.timezone ||
      workspace.salon.active !== true ||
      workspace?.membership?.active !== true ||
      !['owner', 'admin', 'employee'].includes(
        workspace.membership.role
      )
    ) {
      throw new Error(
        'Poslužitelj je vratio neispravno salonsko članstvo.'
      )
    }
  }

  return data
}