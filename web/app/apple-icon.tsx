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
          borderRadius: '40px',
          backgroundColor: '#0f172a',
        }}
      >
        <svg
          width="100"
          height="124"
          viewBox="0 0 100 124"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M50 0 L90 24 L90 68 C90 92 72 112 50 124 C28 112 10 92 10 68 L10 24 Z"
            fill="rgba(255,255,255,0.12)"
          />
          <path
            d="M50 6 L84 27 L84 68 C84 90 68 108 50 118 C32 108 16 90 16 68 L16 27 Z"
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="3"
          />
          <path
            d="M35 54 L22 62 L35 70"
            stroke="white"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M65 54 L78 62 L65 70"
            stroke="white"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M60 44 L42 80"
            stroke="white"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>
    ),
    { ...size }
  )
}
