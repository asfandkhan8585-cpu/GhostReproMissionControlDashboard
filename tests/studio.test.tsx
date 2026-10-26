import React from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import LiveAgentStudio from '../src/LiveAgentStudio'
import { initialConfig } from '../src/api'
afterEach(cleanup)
test('studio identifies playback as simulation', () => {
  render(<LiveAgentStudio activeRepo="owner/repo" config={initialConfig} prs={[]} repros={[]} />)
  expect(screen.getByRole('note').textContent).toContain('SIMULATED')
})
