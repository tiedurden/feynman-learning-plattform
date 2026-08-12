import type { Notebook, Page } from '@/types'

/**
 * Mock seed data used until a real backend is wired up.
 * Demonstrates a multi-level page tree (parent → child → grandchild).
 */

export const seedNotebooks: Notebook[] = [
  { id: 'nb-work', title: 'Work', color: '#7719aa' },
  { id: 'nb-personal', title: 'Personal', color: '#0a7c42' },
  { id: 'nb-study', title: 'Study', color: '#c94f0c' },
  { id: 'nb-history', title: 'History', color: '#1b6ec2' },
  { id: 'nb-biology', title: 'Biology', color: '#0a7c42' },
  { id: 'nb-math', title: 'Math', color: '#b4009e' }
]

export const seedPages: Page[] = [
  // --- Work notebook ---------------------------------------------------------
  {
    id: 'pg-projects',
    notebookId: 'nb-work',
    parentId: null,
    title: 'Projects',
    content: '# Projects\n\nOverview of active projects.',
    boxes: [],
    order: 0
  },
  {
    id: 'pg-project-atlas',
    notebookId: 'nb-work',
    parentId: 'pg-projects',
    title: 'Project Atlas',
    content: '## Project Atlas\n\nGoals, milestones and owners.',
    boxes: [],
    order: 0
  },
  {
    id: 'pg-atlas-kickoff',
    notebookId: 'nb-work',
    parentId: 'pg-project-atlas',
    title: 'Kickoff Notes',
    content: '### Kickoff\n\n- Attendees\n- Decisions\n- Action items',
    boxes: [],
    order: 0
  },
  {
    id: 'pg-atlas-retro',
    notebookId: 'nb-work',
    parentId: 'pg-project-atlas',
    title: 'Retrospective',
    content: '### Retro\n\nWhat went well / what to improve.',
    boxes: [],
    order: 1
  },
  {
    id: 'pg-project-nova',
    notebookId: 'nb-work',
    parentId: 'pg-projects',
    title: 'Project Nova',
    content: '## Project Nova\n\nEarly discovery phase.',
    boxes: [],
    order: 1
  },
  {
    id: 'pg-meetings',
    notebookId: 'nb-work',
    parentId: null,
    title: 'Meetings',
    content: '# Meetings\n\nRunning meeting log.',
    boxes: [],
    order: 1
  },

  // --- Personal notebook -----------------------------------------------------
  {
    id: 'pg-groceries',
    notebookId: 'nb-personal',
    parentId: null,
    title: 'Groceries',
    content: '# Groceries\n\n- Milk\n- Coffee\n- Bread',
    boxes: [],
    order: 0
  },
  {
    id: 'pg-travel',
    notebookId: 'nb-personal',
    parentId: null,
    title: 'Travel',
    content: '# Travel\n\nTrip ideas and bookings.',
    boxes: [],
    order: 1
  },
  {
    id: 'pg-travel-japan',
    notebookId: 'nb-personal',
    parentId: 'pg-travel',
    title: 'Japan 2026',
    content: '## Japan 2026\n\nItinerary draft.',
    boxes: [],
    order: 0
  },

  // --- Study notebook --------------------------------------------------------
  {
    id: 'pg-feynman',
    notebookId: 'nb-study',
    parentId: null,
    title: 'Feynman Technique',
    content: '# Feynman Technique\n\n1. Pick a concept\n2. Teach it simply\n3. Identify gaps\n4. Review & simplify',
    boxes: [],
    order: 0
  },

  // --- History notebook ------------------------------------------------------
  // Notes on a classic school topic that reflect PARTIAL understanding
  // (~60-75%): the core facts, dates and famous figures are recalled well,
  // but the causes, mechanisms and consequences are vague, hedged or missing.
  {
    id: 'pg-french-revolution',
    notebookId: 'nb-history',
    parentId: null,
    title: 'The French Revolution',
    content:
      '# The French Revolution (1789–1799)\n\nBig turning point in France — the people overthrew the king and the whole system changed.',
    boxes: [
      {
        id: 'box-fr-overview',
        x: 40,
        y: 20,
        width: 260,
        text:
          'Overview: Started in 1789, ended around 1799 when Napoleon took over. France went from an absolute monarchy to a republic (at least for a while).'
      },
      {
        id: 'box-fr-causes',
        x: 330,
        y: 20,
        width: 280,
        text:
          'Causes: People were poor and hungry, bread was expensive, and the king (Louis XVI) spent too much money. The Third Estate paid all the taxes while nobles/clergy paid none. Not 100% sure how the tax system actually worked though.'
      },
      {
        id: 'box-fr-estates',
        x: 40,
        y: 190,
        width: 260,
        text:
          'Three Estates = clergy (1st), nobles (2nd), everyone else (3rd). The Estates-General met in 1789. The 3rd Estate broke away and made the National Assembly. (Need to review why the voting setup made them so angry.)'
      },
      {
        id: 'box-fr-bastille',
        x: 330,
        y: 210,
        width: 280,
        text:
          'Storming of the Bastille — 14 July 1789. A prison/fortress. Symbolic start of the revolution. Not totally clear why the Bastille specifically mattered besides gunpowder + symbolism.'
      },
      {
        id: 'box-fr-terror',
        x: 40,
        y: 360,
        width: 260,
        text:
          'Reign of Terror: Robespierre and the guillotine, thousands executed. Somewhere around 1793–94? Ended when Robespierre himself got executed. Fuzzy on how the Committee of Public Safety actually got so much power.'
      },
      {
        id: 'box-fr-outcome',
        x: 330,
        y: 400,
        width: 280,
        text:
          'Outcome: King and queen (Marie Antoinette) executed. Declaration of the Rights of Man. Eventually Napoleon takes over ~1799. Still unsure whether the revolution really "succeeded" or just led to another strongman.'
      }
    ],
    order: 0
  },
  {
    id: 'pg-fr-key-figures',
    notebookId: 'nb-history',
    parentId: 'pg-french-revolution',
    title: 'Key Figures',
    content:
      '## Key Figures\n\n- Louis XVI — the king, executed 1793\n- Marie Antoinette — queen, "let them eat cake" (maybe a myth?)\n- Robespierre — led the Terror\n- Napoleon — took power at the end\n\nStill need to add Danton and Marat and what exactly they did.',
    boxes: [],
    order: 0
  },

  // --- Biology notebook ------------------------------------------------------
  // Notes that reflect DEEP understanding (~90%+): accurate mechanism, correct
  // terminology, the two coupled stages explained, inputs/outputs balanced,
  // and the "why it matters" connected to the bigger picture. No hedging.
  {
    id: 'pg-photosynthesis',
    notebookId: 'nb-biology',
    parentId: null,
    title: 'Photosynthesis',
    content:
      '# Photosynthesis\n\nHow plants, algae and some bacteria convert light energy into chemical energy stored in glucose.\n\nOverall equation:\n6 CO₂ + 6 H₂O + light → C₆H₁₂O₆ + 6 O₂',
    boxes: [
      {
        id: 'box-ps-overview',
        x: 40,
        y: 20,
        width: 280,
        text:
          'Big picture: Photosynthesis takes low-energy inorganic molecules (CO₂ + water) and, using light captured by chlorophyll, builds high-energy glucose while releasing O₂. It is essentially the reverse of aerobic respiration and underpins nearly all food chains.'
      },
      {
        id: 'box-ps-light',
        x: 340,
        y: 20,
        width: 300,
        text:
          'Light-dependent reactions (thylakoid membranes): Chlorophyll in Photosystems II and I absorbs light, exciting electrons. Water is split (photolysis) → O₂ + H⁺ + electrons. The electron transport chain pumps H⁺ into the thylakoid lumen; the resulting gradient drives ATP synthase (chemiosmosis). Products: ATP and NADPH. O₂ is the by-product.'
      },
      {
        id: 'box-ps-calvin',
        x: 40,
        y: 210,
        width: 280,
        text:
          'Light-independent reactions / Calvin cycle (stroma): Uses the ATP + NADPH from the light stage. CO₂ is fixed onto RuBP by the enzyme RuBisCO, producing 3-PGA, which is reduced to G3P. Some G3P forms glucose; the rest regenerates RuBP so the cycle continues. No light needed directly — it depends on the products of the light stage.'
      },
      {
        id: 'box-ps-coupling',
        x: 340,
        y: 240,
        width: 300,
        text:
          'Why the two stages are coupled: The light reactions supply the energy currency (ATP) and reducing power (NADPH) that the Calvin cycle spends to fix carbon. Without ATP/NADPH the Calvin cycle stops; without CO₂ fixation, NADP⁺/ADP are not regenerated and the light reactions back up. They are interdependent, not sequential islands.'
      },
      {
        id: 'box-ps-factors',
        x: 40,
        y: 420,
        width: 280,
        text:
          'Limiting factors: rate rises with light intensity, CO₂ concentration and temperature — until another factor becomes limiting or (for temperature) enzymes like RuBisCO denature. This is why greenhouses enrich CO₂ and control temperature/light.'
      },
      {
        id: 'box-ps-significance',
        x: 340,
        y: 460,
        width: 300,
        text:
          'Significance: converts solar energy into the chemical energy that feeds ecosystems, produces the atmospheric O₂ we breathe, and removes CO₂ — directly relevant to the carbon cycle and climate. I can explain each step and how they connect without notes.'
      }
    ],
    order: 0
  },

  // --- Math notebook ---------------------------------------------------------
  // Notes that reflect MINIMAL understanding (~30%): the formula is half-
  // remembered, terms are unclear, and there is confusion about when/why it
  // applies. Lots of "?" and guesses — recall without comprehension.
  {
    id: 'pg-pythagoras',
    notebookId: 'nb-math',
    parentId: null,
    title: 'Pythagorean Theorem',
    content:
      '# Pythagorean Theorem\n\nSomething about triangles and squares? a² + b² = c² (I think).',
    boxes: [
      {
        id: 'box-py-formula',
        x: 40,
        y: 20,
        width: 260,
        text:
          'Formula is a² + b² = c²… or was it a + b = c²? c is the long side I think. Not sure which side is which.'
      },
      {
        id: 'box-py-when',
        x: 320,
        y: 30,
        width: 260,
        text:
          'Only works for triangles? Maybe only right-angled ones?? Not sure how to tell which triangles it applies to.'
      },
      {
        id: 'box-py-use',
        x: 60,
        y: 190,
        width: 260,
        text:
          'Used to find a missing side. But if I have two sides how do I know if I add or subtract? Keep getting the wrong answer in exercises.'
      },
      {
        id: 'box-py-why',
        x: 330,
        y: 210,
        width: 240,
        text:
          'No idea WHY it is true. Something with squares on the sides? Never understood the proof.'
      }
    ],
    order: 0
  }
]

