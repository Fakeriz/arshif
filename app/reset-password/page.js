'use client'
import App from '../page'

// The password-reset email redirects here (redirectTo: `${origin}/reset-password`).
// We reuse the main App so Supabase (detectSessionInUrl) parses the recovery token and
// fires the PASSWORD_RECOVERY event, which opens the "Set new password" screen.
export default function ResetPasswordPage() {
  return <App />
}
