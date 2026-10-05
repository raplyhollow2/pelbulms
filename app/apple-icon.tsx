import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundImage: 'linear-gradient(135deg, #F0C14B 0%, #E8B423 48%, #E25C14 100%)',
        }}
      >
        <svg width="132" height="132" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="38" fill="#FFF6EA" />
          <path d="M22 57c1-8 8-13 18-13s17 5 18 13v11c0 5-5 8-10 8H32c-5 0-10-3-10-8V57z" fill="#C45A12" />
          <path d="M34 48.5 40 58l6-9.5" fill="none" stroke="#E8B423" strokeWidth="2.2" strokeLinecap="round" />
          <rect x="47" y="53" width="20" height="15" rx="2.2" fill="#E25C14" />
          <rect x="48.3" y="54.4" width="8.2" height="12.2" rx="1" fill="#FFF9EC" />
          <rect x="57.3" y="54.4" width="8.4" height="12.2" rx="1" fill="#FFF1CC" />
          <circle cx="40" cy="36" r="16.6" fill="#F6C7A2" />
          <ellipse cx="40" cy="24" rx="17" ry="10" fill="#3A2A22" />
          <ellipse cx="33" cy="36.4" rx="2.15" ry="2.55" fill="#2C221C" />
          <ellipse cx="47" cy="36.4" rx="2.15" ry="2.55" fill="#2C221C" />
          <path d="M33.2 43.4c1.8 3.4 11.8 3.4 13.6 0" fill="none" stroke="#C45C4C" strokeWidth="1.7" strokeLinecap="round" />
          <g transform="translate(16.6 50.8) rotate(-24)">
            <rect x="-5.1" y="-12.4" width="2.2" height="6.6" rx="1.1" fill="#F6C7A2" />
            <rect x="-2.55" y="-13.8" width="2.3" height="7.8" rx="1.15" fill="#F6C7A2" />
            <rect x="0.05" y="-13.1" width="2.2" height="7.1" rx="1.1" fill="#F6C7A2" />
            <rect x="2.5" y="-11.2" width="1.95" height="5.5" rx="0.95" fill="#F6C7A2" />
            <ellipse cx="-0.15" cy="-4.6" rx="4.85" ry="3.55" fill="#F6C7A2" />
            <ellipse cx="-4.15" cy="-3.15" rx="1.7" ry="2.55" fill="#F6C7A2" transform="rotate(-38 -4.15 -3.15)" />
          </g>
        </svg>
      </div>
    ),
    { ...size }
  )
}
