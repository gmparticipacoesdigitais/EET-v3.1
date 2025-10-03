import admin from 'firebase-admin'

let app
let initialized = false

export function initFirebaseAdmin() {
  if (initialized) return admin

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY

  try {
    if (!admin.apps.length) {
      let credential
      // Prefer explicit service account via env when available
      if (clientEmail && rawPrivateKey) {
        const privateKey = rawPrivateKey.includes('\n') ? rawPrivateKey : rawPrivateKey.replace(/\\n/g, '\n')
        credential = admin.credential.cert({ projectId, clientEmail, privateKey })
      } else {
        // Fallback: Application Default Credentials (e.g., GOOGLE_APPLICATION_CREDENTIALS)
        credential = admin.credential.applicationDefault()
      }

      admin.initializeApp({
        credential,
        projectId: projectId || undefined,
      })
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize Firebase Admin:', e)
    throw e
  }
  app = admin
  initialized = true
  return admin
}

export function getAdmin() {
  if (!initialized) return initFirebaseAdmin()
  return app
}

export function getDb() {
  return getAdmin().firestore()
}

export function getAuthAdmin() {
  return getAdmin().auth()
}
