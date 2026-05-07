import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the Trominal foundation screen', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Trominal' })).toBeInTheDocument()
    expect(screen.getByText('Phase 0 foundation')).toBeInTheDocument()
  })
})
