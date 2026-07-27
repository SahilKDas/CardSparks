// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App, { buildCalendarFile, CampaignDebrief, LaunchKitStudio, OutcomeModal } from './App'

const launchKit = {
  action_id: 22, provider: 'local', offer_name: 'Festival Fuel',
  campaign_code: 'FESTIVALFUEL', owner_approved: false, approved_at: null, edited_at: null,
  audience: 'People heading to the nearby night market',
  schedule: { date: '2026-08-01', time: '15:30', label: 'Suggested launch time' },
  customer_copy: { social: 'Fuel up before the market.', sms: 'Fuel up before the market.', sign_headline: 'FESTIVAL FUEL', sign_body: 'Cold brew and pastry before the market' },
  operations: [
    { task: 'Prepare the featured products', timing: 'Morning of event', owner: 'Shift lead' },
    { task: 'Set up the customer-facing sign', timing: 'Before launch', owner: 'Front counter' },
  ],
  measurement: { metric: 'Event-day sales versus comparable baseline', baseline_sales: 1443 },
  generated_at: '2026-07-26T12:00:00Z',
}

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

  it('moves a recommendation into a ready Launch Kit without completing it', async () => {
    render(<App />)
    fireEvent.click(screen.getByText('See the coffee shop demo'))
    await screen.findByText('Three moves worth making')
    const plannedAction = {
      id: 22, profile_name: 'Juniper Coffee Co.', recommendation_id: 'event-rush',
      title: 'Turn Friday’s festival crowd into regulars', action: 'Prep more cold brew before the festival.',
      success_metric: 'Friday sales versus baseline', scheduled_for: '2026-08-01', status: 'planned',
      is_demo: true, outcome: null, has_launch_kit: false, launch_kit: null,
    }
    vi.mocked(fetch).mockImplementation((url, options = {}) => {
      if (String(url).endsWith('/api/actions') && options.method === 'POST') return Promise.resolve({ ok: true, json: async () => plannedAction })
      if (String(url).endsWith('/api/actions/22/launch-kit')) return Promise.resolve({ ok: true, json: async () => launchKit })
      return Promise.reject(new Error('unused test route'))
    })
    fireEvent.click(screen.getAllByText('Put this in my plan')[0])
    await screen.findByText('In Playbook')
    fireEvent.click(screen.getByText('Today’s Playbook'))
    fireEvent.click(await screen.findByText('Build Launch Kit'))
    expect(await screen.findByRole('dialog', { name: 'Festival Fuel' })).toBeTruthy()
    expect(screen.getByText('Your action stays planned until you mark it done.')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Close Launch Kit Studio'))
    await waitFor(() => expect(screen.getByText('Kit ready')).toBeTruthy())
    expect(screen.getByText('Open Launch Kit')).toBeTruthy()
    expect(screen.getByText('planned')).toBeTruthy()
  })
})

describe('Launch Kit artifacts', () => {
  it('builds a calendar task with the selected title, date, and time', () => {
    const calendar = buildCalendarFile(launchKit)
    expect(calendar).toContain('SUMMARY:Festival Fuel')
    expect(calendar).toContain('DTSTART:20260801T153000')
    expect(calendar).toContain('Campaign code: FESTIVALFUEL')
    expect(calendar).toContain('Nothing is published or sent automatically.')
  })

  it('shows complete artifacts and copies the exact customer text', async () => {
    const action = { profile_name: 'Juniper Coffee Co.', is_demo: true }
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const { container } = render(<LaunchKitStudio action={action} kit={launchKit} close={vi.fn()} refresh={vi.fn()} />)
    expect(screen.getByText('Phone preview')).toBeTruthy()
    expect(screen.getByText('Print-ready preview')).toBeTruthy()
    expect(screen.getByText('Operations checklist')).toBeTruthy()
    expect(screen.getByText('$1,443')).toBeTruthy()
    expect(screen.getByText('Download calendar task')).toBeTruthy()
    expect(container.querySelector('.launch-sign').textContent).toContain('FESTIVAL FUEL')
    expect(screen.queryByText(/Publish|Schedule|Send message/)).toBeNull()
    fireEvent.click(screen.getByLabelText('Copy social caption'))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(launchKit.customer_copy.social))
  })

  it('saves owner edits as an approved Launch Kit version', async () => {
    const save = vi.fn(async (draft, approved) => ({ ...draft, owner_approved: approved, approved_at: '2026-07-26T12:00:00Z' }))
    render(<LaunchKitStudio action={{ profile_name: 'Juniper Coffee Co.', is_demo: true }} kit={launchKit} close={vi.fn()} refresh={vi.fn()} save={save} />)
    fireEvent.click(screen.getByText('Edit kit'))
    fireEvent.change(screen.getByLabelText('Campaign code'), { target: { value: 'MARKET22' } })
    fireEvent.change(screen.getByLabelText('Social caption'), { target: { value: 'A neighbor-made market stop.' } })
    fireEvent.change(screen.getByLabelText('Launch time'), { target: { value: '16:15' } })
    fireEvent.change(screen.getByLabelText('Owner 1'), { target: { value: 'Sam' } })
    fireEvent.click(screen.getByText('Save & approve'))
    await waitFor(() => expect(save).toHaveBeenCalled())
    const [draft, approved] = save.mock.calls[0]
    expect(approved).toBe(true)
    expect(draft.campaign_code).toBe('MARKET22')
    expect(draft.customer_copy.social).toBe('A neighbor-made market stop.')
    expect(draft.schedule.time).toBe('16:15')
    expect(draft.operations[0].owner).toBe('Sam')
    expect(await screen.findByText('Owner approved')).toBeTruthy()
  })

  it('records campaign-code redemptions with the measured outcome', async () => {
    const save = vi.fn(() => Promise.resolve())
    render(<OutcomeModal action={{ title: 'Festival move', launch_kit: launchKit }} close={vi.fn()} save={save} />)
    fireEvent.change(screen.getByLabelText('Observed sales that day'), { target: { value: '1700' } })
    fireEvent.change(screen.getByLabelText(/Campaign code redemptions/), { target: { value: '24' } })
    fireEvent.change(screen.getByLabelText(/Quick note/), { target: { value: 'Customers mentioned the sign.' } })
    fireEvent.click(screen.getByText('Save result and teach Sidekick'))
    await waitFor(() => expect(save).toHaveBeenCalledWith({ observed_sales: 1700, helped: 'yes', redemptions: 24, note: 'Customers mentioned the sign.' }))
  })

  it('renders a non-causal Campaign Debrief learning timeline', () => {
    const action = {
      title: 'Turn festival traffic into regulars', action: 'Run the Festival Fuel play.',
      scheduled_for: '2026-08-01', signals: ['event', 'sales'],
      evidence: ['Night market is nearby', 'Friday sales are strongest'], launch_kit: { ...launchKit, owner_approved: true },
      outcome: { observed_sales: 1653, baseline_sales: 1443, lift_amount: 210, helped: 'yes', redemptions: 24, note: 'Customers mentioned the sign.' },
    }
    render(<CampaignDebrief action={action} close={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Turn festival traffic into regulars' })).toBeTruthy()
    expect(screen.getByText('1 · Signals')).toBeTruthy()
    expect(screen.getByText('5 · Lesson')).toBeTruthy()
    expect(screen.getByText(/association—not proof/)).toBeTruthy()
    expect(screen.getByText(/24 code redemptions/)).toBeTruthy()
    expect(screen.getByText('What Sidekick will do differently next time')).toBeTruthy()
  })
})
