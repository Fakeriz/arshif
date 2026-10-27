export async function sendTelegramSupportNotification({
  type = 'bug',
  subject = '',
  description = '',
  userEmail = '',
  userId = '',
  file = null,
  accessToken = '',
}) {
  const formData = new FormData()
  formData.append('type', type)
  formData.append('subject', subject)
  formData.append('description', description)
  formData.append('userEmail', userEmail || '')
  formData.append('userId', userId || '')
  if (file) formData.append('file', file, file.name || 'attachment')

  const response = await fetch('/api/telegram-support', {
    method: 'POST',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: formData,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Gagal mengirim laporan ke Telegram')
  return data
}
