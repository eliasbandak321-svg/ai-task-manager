import { useState } from 'react'

// Temporary smoke test: proves React, TypeScript and Tailwind work together.
// Replaced by the landing page in Checkpoint 3.
function App() {
  const [count, setCount] = useState(0)

  return (
    <main className="grid min-h-svh place-items-center bg-night px-4 text-center text-ink">
      <div className="space-y-6">
        <h1 className="text-4xl font-medium tracking-tight">AI Task Manager</h1>
        <p className="text-ink/70">React + TypeScript + Tailwind are working.</p>
        <button
          type="button"
          onClick={() => setCount((c) => c + 1)}
          className="rounded-md bg-ink px-5 py-2.5 font-medium text-night transition hover:bg-glow focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-glow"
        >
          Clicked {count} {count === 1 ? 'time' : 'times'}
        </button>
      </div>
    </main>
  )
}

export default App
