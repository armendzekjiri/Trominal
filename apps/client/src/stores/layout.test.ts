import { beforeEach, describe, expect, it } from 'vitest'
import { useLayout } from './layout'

describe('layout store', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useLayout.setState({ sidebarCollapsed: false })
  })

  it('toggles the sidebar and remembers it on this device', () => {
    useLayout.getState().toggleSidebar()
    expect(useLayout.getState().sidebarCollapsed).toBe(true)
    expect(JSON.parse(window.localStorage.getItem('trominal:layout') ?? '{}')).toEqual({
      sidebarCollapsed: true,
    })

    useLayout.getState().toggleSidebar()
    expect(useLayout.getState().sidebarCollapsed).toBe(false)
  })
})
