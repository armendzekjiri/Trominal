import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { HostKeyDialog } from './HostKeyDialog'
import { useHostKeyPrompt, type HostKeyPrompt } from './host-key-prompt'

const PRESENTED = {
  keyType: 'ssh-ed25519',
  publicKey: 'AAAAC3NzaC1lZDI1NTE5AAAAIAJ0zOYsiehXYJEtufsQzfH49rgGwhlP1w6Ub9IZS3b9',
  fingerprint: 'SHA256:cc+OHycpL60Ov6zbIi5p9icXpZtp03nkzYuzTVU/dC4',
}
const APPROVED = { ...PRESENTED, publicKey: 'AAAAold', fingerprint: 'SHA256:old' }

function prompt(overrides: Partial<HostKeyPrompt> = {}): HostKeyPrompt {
  return {
    mode: 'approve',
    hostId: 'host_1',
    label: 'web-01',
    endpoint: 'deploy@10.0.0.1:22',
    presented: [PRESENTED],
    expected: [],
    sessionOnly: false,
    ...overrides,
  }
}

function open(next: HostKeyPrompt): Promise<boolean> {
  let answer!: Promise<boolean>
  act(() => {
    answer = useHostKeyPrompt.getState().ask(next)
  })
  return answer
}

function renderDialog() {
  return render(
    <MemoryRouter>
      <HostKeyDialog />
    </MemoryRouter>,
  )
}

afterEach(() => {
  act(() => useHostKeyPrompt.getState().answer(false))
})

describe('HostKeyDialog', () => {
  it('shows the full fingerprint and focuses Cancel, not Trust', async () => {
    renderDialog()
    const answer = open(prompt())

    const dialog = screen.getByRole('dialog', { name: 'Verify host key' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText(PRESENTED.fingerprint)).toBeInTheDocument()
    expect(screen.getByText('ED25519')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Trust and connect' }))
    await expect(answer).resolves.toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('declines on Escape and on backdrop click', async () => {
    renderDialog()
    const escaped = open(prompt())
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await expect(escaped).resolves.toBe(false)

    const backdrop = open(prompt())
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement as HTMLElement)
    await expect(backdrop).resolves.toBe(false)
  })

  it('keeps Tab focus inside the dialog', () => {
    renderDialog()
    void open(prompt())
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    const trust = screen.getByRole('button', { name: 'Trust and connect' })

    trust.focus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' })
    expect(cancel).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true })
    expect(trust).toHaveFocus()
  })

  it('offers no way to accept a changed key', async () => {
    renderDialog()
    const answer = open(prompt({ mode: 'changed', expected: [APPROVED] }))

    expect(screen.getByRole('dialog', { name: 'Host key changed' })).toBeInTheDocument()
    expect(screen.getByText('SHA256:old')).toBeInTheDocument()
    expect(screen.getByText(PRESENTED.fingerprint)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /trust|replace|accept/i })).toBeNull()
    expect(screen.getByRole('button', { name: 'Open host editor' })).toBeInTheDocument()

    // Even a programmatic "approve" can't turn a changed-key notice into approval.
    act(() => useHostKeyPrompt.getState().answer(true))
    await expect(answer).resolves.toBe(false)
  })

  it('requires the explicit replace button to re-approve', async () => {
    renderDialog()
    const answer = open(prompt({ mode: 'replace', expected: [APPROVED] }))

    fireEvent.click(screen.getByRole('button', { name: 'Replace approved key' }))
    await expect(answer).resolves.toBe(true)
  })

  it('explains when an approval only lasts for this session', () => {
    renderDialog()
    void open(prompt({ sessionOnly: true }))
    expect(screen.getByText(/lasts until Trominal restarts/)).toBeInTheDocument()
  })
})
