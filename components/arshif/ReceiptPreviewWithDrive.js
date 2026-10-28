'use client'

import { useState, useMemo, useEffect } from 'react'
import { Eye, HardDrive, ExternalLink, Image as ImageIcon, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

export function extractDriveFileId(url) {
  if (!url || typeof url !== 'string') return null
  const matchD = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (matchD?.[1]) return matchD[1]
  const matchId = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (matchId?.[1]) return matchId[1]
  return null
}

export function getDriveThumbnailUrl(url, size = 800, merchant = '') {
  if (!url || typeof url !== 'string') return url
  // If already data URL or blob URL
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url
  }

  // If it's a Google Drive link
  if (url.includes('drive.google.com')) {
    const fileId = extractDriveFileId(url)
    if (fileId) {
      // Local device cache gives an instant preview before any network call.
      if (typeof localStorage !== 'undefined') {
        try {
          const cached =
            localStorage.getItem(`arshif_receipt_cache_${fileId}`) ||
            localStorage.getItem(`arshif_receipt_cache_${url}`)
          if (cached && (cached.startsWith('data:image') || cached.startsWith('http'))) {
            return cached
          }
        } catch {}
      }

      // Use Google's image CDN directly in the browser. The server proxy is
      // authenticated and reserved for server-side callers.
      return `https://lh3.googleusercontent.com/d/${fileId}=w${Math.min(1600, Math.max(80, Number(size) || 800))}`
    }
  }

  return url
}

export default function ReceiptPreviewWithDrive({
  receiptUrl,
  storageProvider,
  merchantName,
  onOpenFullImage,
}) {
  const [imgError, setImgError] = useState(false)
  const [imgLoading, setImgLoading] = useState(true)
  const [fallbackIndex, setFallbackIndex] = useState(0)

  const isGoogleDrive =
    storageProvider === 'google_drive' ||
    (typeof receiptUrl === 'string' && receiptUrl.includes('drive.google.com'))

  const fileId = useMemo(() => extractDriveFileId(receiptUrl), [receiptUrl])

  // Sequence of fallback image candidate sources
  const candidateUrls = useMemo(() => {
    if (!receiptUrl) return []
    if (receiptUrl.startsWith('data:') || receiptUrl.startsWith('blob:')) {
      return [receiptUrl]
    }

    const list = []

    // 1. Local cached image data
    if (typeof localStorage !== 'undefined' && fileId) {
      try {
        const cached =
          localStorage.getItem(`arshif_receipt_cache_${fileId}`) ||
          localStorage.getItem(`arshif_receipt_cache_${receiptUrl}`)
        if (cached && (cached.startsWith('data:image') || cached.startsWith('http'))) {
          list.push(cached)
        }
      } catch {}
    }

    if (fileId) {
      // 2. Google Usercontent CDN
      list.push(`https://lh3.googleusercontent.com/d/${fileId}=w800`)
      // 3. Google Drive direct thumbnail
      list.push(`https://drive.google.com/thumbnail?id=${fileId}&sz=w800`)
    } else {
      list.push(receiptUrl)
    }

    return Array.from(new Set(list))
  }, [receiptUrl, fileId, merchantName])

  const currentImageSrc = candidateUrls[fallbackIndex] || receiptUrl

  // Reset states when receiptUrl changes
  useEffect(() => {
    setImgError(false)
    setImgLoading(true)
    setFallbackIndex(0)
  }, [receiptUrl])

  if (!receiptUrl) return null

  const handleImageError = () => {
    if (fallbackIndex < candidateUrls.length - 1) {
      // Fall back to the next candidate URL.
      setFallbackIndex((prev) => prev + 1)
      setImgLoading(true)
    } else {
      setImgError(true)
      setImgLoading(false)
    }
  }

  const handleEyeClick = (e) => {
    e.stopPropagation()
    if (onOpenFullImage) {
      onOpenFullImage(currentImageSrc || receiptUrl)
    } else if (isGoogleDrive && receiptUrl.includes('drive.google.com') && typeof window !== 'undefined') {
      window.open(receiptUrl, '_blank', 'noopener,noreferrer')
    } else if (typeof window !== 'undefined') {
      window.open(currentImageSrc, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="w-full space-y-3 mt-4" data-testid="receipt-preview-unified">
      {/* BAGIAN ATAS: Pratinjau Gambar */}
      <div className="relative w-full h-64 rounded-2xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 overflow-hidden flex items-center justify-center">
        {imgLoading && !imgError && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-100/80 dark:bg-zinc-900/80 z-10 backdrop-blur-xs">
            <RefreshCw size={20} className="animate-spin text-zinc-400" />
          </div>
        )}

        {!imgError ? (
          <img
            src={currentImageSrc}
            alt={merchantName ? `Struk ${merchantName}` : 'Receipt preview'}
            className="w-full h-full object-contain p-2 select-none"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onLoad={() => {
              setImgLoading(false)
              setImgError(false)
            }}
            onError={handleImageError}
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2.5 p-6 text-center text-zinc-400 dark:text-zinc-500">
            <div className="w-12 h-12 rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60 flex items-center justify-center text-zinc-600 dark:text-zinc-300">
              <ImageIcon size={26} strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                {merchantName ? `Struk ${merchantName}` : 'Pratinjau Struk'}
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {isGoogleDrive ? 'Tersimpan aman di Google Drive' : 'Foto struk belanja'}
              </p>
            </div>
          </div>
        )}

        {/* Tombol Lihat Gambar Penuh */}
        <button
          type="button"
          onClick={handleEyeClick}
          aria-label="Lihat gambar penuh"
          className="absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full bg-black/75 hover:bg-black text-white flex items-center justify-center backdrop-blur-md shadow-md transition-all active:scale-95 cursor-pointer z-20"
          data-testid="receipt-preview-eye-btn"
        >
          <Eye size={16} strokeWidth={2} />
        </button>
      </div>

      {/* BAGIAN BAWAH: Kartu Tautan Google Drive */}
      {isGoogleDrive ? (
        <a
          href={receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full rounded-2xl bg-zinc-50 dark:bg-[#141416] border border-zinc-200 dark:border-white/10 p-3.5 flex items-center justify-between hover:border-zinc-300 dark:hover:border-white/20 transition-all cursor-pointer group"
          data-testid="receipt-drive-card"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-800 dark:text-zinc-200">
              <HardDrive size={18} strokeWidth={2} />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-xs font-bold text-zinc-950 dark:text-white">
                Google Drive Receipt
              </p>
              <p className="text-[11px] text-zinc-500 font-mono truncate max-w-[210px] sm:max-w-xs">
                {receiptUrl}
              </p>
            </div>
          </div>
          <ExternalLink
            size={15}
            className="text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-white shrink-0 ml-2 transition-colors"
          />
        </a>
      ) : null}
    </div>
  )
}
