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

  it('opens the measured demo story in one click', async () => {
    render(<App />)
    fireEvent.click(screen.getByText('See the coffee shop demo'))
    expect(await screen.findByText(/Good morning, Juniper/)).toBeTruthy()
    expect(screen.getByText('Three moves worth making')).toBeTruthy()
    expect(screen.getByText((_, element) => element.tagName === 'H2' && element.textContent.includes('finished $210 above baseline'))).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('sidekick-profile')).name).toBe('Juniper Coffee Co.')
  })

  it('shows evidence and the measured Playbook', async () => {
    render(<App />)
    fireEvent.click(screen.getByText('See the coffee shop demo'))
    await screen.findByText('Three moves worth making')
    fireEvent.click(screen.getAllByText('How I connected the dots')[0])
    expect(screen.getByText('Waterfront festival is 0.8 mi away on Friday')).toBeTruthy()
    fireEvent.click(screen.getByText('Today’s Playbook'))
    expect(screen.getByText('From counsel to action')).toBeTruthy()
    expect(screen.getByText(/\+\$210/)).toBeTruthy()
  })

  it('validates required business fields', () => {
    render(<App />)
    fireEvent.click(screen.getByText('Next: add sales'))
    expect(screen.getByText('Add your business name and location to continue.')).toBeTruthy()
  })
})
