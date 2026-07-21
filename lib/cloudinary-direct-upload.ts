/**
 * Browser → Cloudinary direct upload (avoids Next.js / Vercel body size limits).
 */
import { makeMediaRef } from '@/lib/media'
import {
  MAX_VIDEO_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_LABEL,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_LABEL,
  VIDEO_EAGER_TRANSFORM,
} from '@/lib/video-url'

export type DirectUploadProgress = (percent: number) => void

export type DirectVideoUploadResult = {
  url: string
  publicId: string
}

export type DirectImageUploadResult = {
  /** Public HTTPS URL suitable for course covers / catalog thumbnails */
  url: string
  publicId: string
}

const ALLOWED_VIDEO = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']

async function signAndUpload(
  file: File,
  opts: {
    folder: string
    resourceType: 'image' | 'video'
    /** Cloudinary delivery type: public covers use "upload"; private videos use "authenticated" */
    accessType: 'upload' | 'authenticated'
    onProgress?: DirectUploadProgress
    eager?: string
    eagerAsync?: boolean
  }
): Promise<Record<string, unknown>> {
  const signRes = await fetch('/api/cloudinary/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      folder: opts.folder,
      resourceType: opts.resourceType,
      accessType: opts.accessType,
      ...(opts.eager
        ? { eager: opts.eager, eagerAsync: opts.eagerAsync !== false }
        : {}),
    }),
  })
  const signData = await signRes.json()
  if (!signRes.ok) {
    throw new Error(signData.error || 'Failed to get upload signature')
  }

  const form = new FormData()
  form.append('file', file)
  form.append('api_key', signData.apiKey)
  form.append('timestamp', String(signData.timestamp))
  form.append('signature', signData.signature)
  form.append('folder', signData.folder)
  form.append('type', signData.type || opts.accessType)
  if (signData.eager) form.append('eager', signData.eager)
  if (signData.eager_async) form.append('eager_async', String(signData.eager_async))

  const cloudName = signData.cloudName as string
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${opts.resourceType}/upload`

  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', uploadUrl)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) {
        opts.onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300 && json.public_id) {
          resolve(json)
        } else {
          reject(new Error(json.error?.message || json.error || 'Cloudinary upload failed'))
        }
      } catch {
        reject(new Error('Invalid response from Cloudinary'))
      }
    }
    xhr.onerror = () => reject(new Error('Network error during Cloudinary upload'))
    xhr.send(form)
  })
}

export async function uploadVideoDirectToCloudinary(
  file: File,
  opts: {
    folder: string
    onProgress?: DirectUploadProgress
  }
): Promise<DirectVideoUploadResult> {
  if (!ALLOWED_VIDEO.includes(file.type)) {
    throw new Error('Unsupported video type. Use MP4, WEBM, OGG or MOV.')
  }
  if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
    throw new Error(`File too large. Maximum size is ${MAX_VIDEO_UPLOAD_LABEL}.`)
  }

  const result = await signAndUpload(file, {
    folder: opts.folder,
    resourceType: 'video',
    accessType: 'authenticated',
    onProgress: opts.onProgress,
    eager: VIDEO_EAGER_TRANSFORM,
    eagerAsync: true,
  })

  const publicId = result.public_id as string
  return {
    publicId,
    url: makeMediaRef('video', publicId),
  }
}

/** Public image upload for course covers / media library (bypasses Next body limits). */
export async function uploadImageDirectToCloudinary(
  file: File,
  opts: {
    folder: string
    onProgress?: DirectUploadProgress
  }
): Promise<DirectImageUploadResult> {
  if (!ALLOWED_IMAGE.includes(file.type)) {
    throw new Error('Unsupported image type. Use JPG, PNG, WEBP, AVIF or GIF.')
  }
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error(`File too large. Maximum size is ${MAX_IMAGE_UPLOAD_LABEL}.`)
  }

  const result = await signAndUpload(file, {
    folder: opts.folder,
    resourceType: 'image',
    accessType: 'upload',
    onProgress: opts.onProgress,
  })

  const publicId = result.public_id as string
  const secureUrl = (result.secure_url as string) || ''
  if (!secureUrl) {
    throw new Error('Cloudinary did not return an image URL')
  }
  return { publicId, url: secureUrl }
}
