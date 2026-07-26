// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline test'))))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Sidekick onboarding', () => {
  it('shows the business onboarding first', () => {
    render(<App />)
    expect(screen.getByText('Tell me about your business')).toBeTruthy()
    expect(screen.getByText('See the coffee shop demo')).toBeTruthy()
  })

  it('opens the ready-made demo in one click', () => {
    render(<App />)
    fireEvent.click(screen.getByText('See the coffee shop demo'))
    expect(screen.getByText(/Good morning, Juniper/)).toBeTruthy()
    expect(screen.getByText('Three moves worth making')).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('sidekick-profile')).name).toBe('Juniper Coffee Co.')
  })

  it('validates required business fields', () => {
    render(<App />)
    fireEvent.click(screen.getByText('Next: add sales'))
    expect(screen.getByText('Add your business name and location to continue.')).toBeTruthy()
  })
})
