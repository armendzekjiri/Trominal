import { render, screen } from '@testing-library/react'
import { encode } from 'uqr'
import { describe, expect, it } from 'vitest'
import { QrCode } from './qr-code'

const URI = 'otpauth://totp/Trominal:me%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Trominal'

describe('QrCode', () => {
  it('renders an accessible SVG sized to the QR matrix including the quiet zone', () => {
    render(<QrCode value={URI} label="QR code for your authenticator app" />)

    const svg = screen.getByRole('img', { name: 'QR code for your authenticator app' })
    const modules = encode(URI, { ecc: 'M', border: 4 }).size
    expect(svg).toHaveAttribute('viewBox', `0 0 ${modules} ${modules}`)
  })

  it('draws one square per dark module', () => {
    const { container } = render(<QrCode value={URI} label="qr" />)

    const dark = encode(URI, { ecc: 'M', border: 4 }).data.flat().filter(Boolean).length
    const squares = container.querySelector('path')?.getAttribute('d')?.match(/M/g)?.length
    expect(squares).toBe(dark)
  })

  it('is dark-on-white regardless of theme', () => {
    const { container } = render(<QrCode value={URI} label="qr" />)

    expect(container.querySelector('rect')).toHaveAttribute('fill', '#ffffff')
    expect(container.querySelector('path')).toHaveAttribute('fill', '#000000')
  })
})
