import { useState } from 'react'
import { FlatBaseline } from './components/FlatBaseline'
import { ApproachA } from './components/ApproachA'
import { ApproachB } from './components/ApproachB'
import { ApproachC } from './components/ApproachC'
import { GlobalFlat } from './components/GlobalFlat'
import { GlobalA } from './components/GlobalA'
import { GlobalB } from './components/GlobalB'
import { GlobalC } from './components/GlobalC'
import { DevTest } from './components/DevTest'
import { AnalysisViewer } from './components/AnalysisViewer'
import './App.css'

const tabs = [
  // --- Abordagens com 2 services (Counter + Todo) ---
  { id: 'flat', label: 'Flat (Baseline)', component: FlatBaseline },
  { id: 'a', label: 'A) Computed Recursivo', component: ApproachA },
  { id: 'b', label: 'B) meta.postprocess', component: ApproachB },
  { id: 'c', label: 'C) computedLens Factory', component: ApproachC },
  // --- Global store (padrão real: 3 services + AppService<T>) ---
  { id: 'global-flat', label: 'Global Flat (Real)', component: GlobalFlat },
  { id: 'global-a', label: 'Global A) Recursivo', component: GlobalA },
  { id: 'global-b', label: 'Global B) postprocess', component: GlobalB },
  { id: 'global-c', label: 'Global C) Factory', component: GlobalC },
  // --- Developer test stores ---
  { id: 'dev-test', label: 'Dev Test', component: DevTest },
  // --- Análise ---
  { id: 'analysis', label: 'Análise', component: AnalysisViewer },
] as const

function App() {
  const [activeTab, setActiveTab] = useState<typeof tabs[number]['id']>(tabs[0].id)
  const ActiveComponent = tabs.find(t => t.id === activeTab)!.component

  return (
    <div className="app">
      <h1>POC: zustand-computed + zustand-lens</h1>
      <nav className="tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <main>
        <ActiveComponent />
      </main>
    </div>
  )
}

export default App
