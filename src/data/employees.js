// Employee Data Management - Local Storage Only (Xano integration to be added)

const LS_KEY = (uid) => `employees:${uid}`

/**
 * Subscribe to employee changes
 * Currently uses localStorage only, can be extended to use Xano in the future
 */
export function subscribeEmployees(uid, onChange) {
  if (!uid) return () => {}

  const loadLocal = () => {
    try {
      const raw = localStorage.getItem(LS_KEY(uid))
      const list = raw ? JSON.parse(raw) : []
      onChange(list)
    } catch (error) {
      console.warn('Failed to load employees from localStorage:', error)
      onChange([])
    }
  }

  // Load from localStorage
  loadLocal()

  // Return unsubscribe function (currently no-op)
  return () => {}
}

/**
 * Create or update an employee
 */
export async function upsertEmployee(uid, emp) {
  if (!uid || !emp) {
    throw new Error('User ID and employee data are required')
  }

  try {
    const raw = localStorage.getItem(LS_KEY(uid))
    const list = raw ? JSON.parse(raw) : []

    const idx = list.findIndex((e) => e.id === emp.id)
    const now = Date.now()

    const toSave = {
      ...emp,
      updatedAt: now,
      createdAt: emp.createdAt || now
    }

    if (idx >= 0) {
      list[idx] = toSave
    } else {
      list.unshift(toSave)
    }

    localStorage.setItem(LS_KEY(uid), JSON.stringify(list))

    // TODO: Sync with Xano backend
    // await xanoClient.upsertEmployee(uid, toSave)

  } catch (error) {
    console.error('Failed to save employee:', error)
    throw error
  }
}

/**
 * Remove an employee
 */
export async function removeEmployee(uid, id) {
  if (!uid || !id) {
    throw new Error('User ID and employee ID are required')
  }

  try {
    const raw = localStorage.getItem(LS_KEY(uid))
    const list = raw ? JSON.parse(raw) : []
    const next = list.filter((e) => e.id !== id)

    localStorage.setItem(LS_KEY(uid), JSON.stringify(next))

    // TODO: Sync with Xano backend
    // await xanoClient.removeEmployee(uid, id)

  } catch (error) {
    console.error('Failed to remove employee:', error)
    throw error
  }
}

/**
 * Get all employees for a user
 */
export function getEmployees(uid) {
  if (!uid) return []

  try {
    const raw = localStorage.getItem(LS_KEY(uid))
    return raw ? JSON.parse(raw) : []
  } catch (error) {
    console.warn('Failed to get employees:', error)
    return []
  }
}

/**
 * Clear all employees for a user (useful for logout)
 */
export function clearEmployees(uid) {
  if (!uid) return

  try {
    localStorage.removeItem(LS_KEY(uid))
  } catch (error) {
    console.warn('Failed to clear employees:', error)
  }
}
