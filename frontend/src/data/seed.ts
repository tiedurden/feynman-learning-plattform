import type { Notebook, Page } from '@/types'

/**
 * Mock seed data used until a real backend is wired up.
 * Demonstrates a multi-level page tree (parent → child → grandchild).
 */

export const seedNotebooks: Notebook[] = [
  { id: 'nb-work', title: 'Work', color: '#7719aa' },
  { id: 'nb-personal', title: 'Personal', color: '#0a7c42' },
  { id: 'nb-study', title: 'Study', color: '#c94f0c' }
]

export const seedPages: Page[] = [
  // --- Work notebook ---------------------------------------------------------
  {
    id: 'pg-projects',
    notebookId: 'nb-work',
    parentId: null,
    title: 'Projects',
    content: '# Projects\n\nOverview of active projects.',
    order: 0
  },
  {
    id: 'pg-project-atlas',
    notebookId: 'nb-work',
    parentId: 'pg-projects',
    title: 'Project Atlas',
    content: '## Project Atlas\n\nGoals, milestones and owners.',
    order: 0
  },
  {
    id: 'pg-atlas-kickoff',
    notebookId: 'nb-work',
    parentId: 'pg-project-atlas',
    title: 'Kickoff Notes',
    content: '### Kickoff\n\n- Attendees\n- Decisions\n- Action items',
    order: 0
  },
  {
    id: 'pg-atlas-retro',
    notebookId: 'nb-work',
    parentId: 'pg-project-atlas',
    title: 'Retrospective',
    content: '### Retro\n\nWhat went well / what to improve.',
    order: 1
  },
  {
    id: 'pg-project-nova',
    notebookId: 'nb-work',
    parentId: 'pg-projects',
    title: 'Project Nova',
    content: '## Project Nova\n\nEarly discovery phase.',
    order: 1
  },
  {
    id: 'pg-meetings',
    notebookId: 'nb-work',
    parentId: null,
    title: 'Meetings',
    content: '# Meetings\n\nRunning meeting log.',
    order: 1
  },

  // --- Personal notebook -----------------------------------------------------
  {
    id: 'pg-groceries',
    notebookId: 'nb-personal',
    parentId: null,
    title: 'Groceries',
    content: '# Groceries\n\n- Milk\n- Coffee\n- Bread',
    order: 0
  },
  {
    id: 'pg-travel',
    notebookId: 'nb-personal',
    parentId: null,
    title: 'Travel',
    content: '# Travel\n\nTrip ideas and bookings.',
    order: 1
  },
  {
    id: 'pg-travel-japan',
    notebookId: 'nb-personal',
    parentId: 'pg-travel',
    title: 'Japan 2026',
    content: '## Japan 2026\n\nItinerary draft.',
    order: 0
  },

  // --- Study notebook --------------------------------------------------------
  {
    id: 'pg-feynman',
    notebookId: 'nb-study',
    parentId: null,
    title: 'Feynman Technique',
    content: '# Feynman Technique\n\n1. Pick a concept\n2. Teach it simply\n3. Identify gaps\n4. Review & simplify',
    order: 0
  }
]

