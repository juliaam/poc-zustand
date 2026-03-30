import { type ReactNode } from 'react'

type StorePanelProps = {
  title: string
  description: string
  children: ReactNode
}

export function StorePanel({ title, description, children }: StorePanelProps) {
  return (
    <div className="store-panel">
      <h2>{title}</h2>
      <p className="description">{description}</p>
      <div className="panel-content">{children}</div>
    </div>
  )
}

type ValueDisplayProps = {
  label: string
  value: unknown
  isComputed?: boolean
}

export function ValueDisplay({ label, value, isComputed }: ValueDisplayProps) {
  return (
    <div className={`value-display ${isComputed ? 'computed' : ''}`}>
      <span className="label">{label}:</span>
      <span className="value">
        {typeof value === 'boolean'
          ? value ? 'true' : 'false'
          : String(value)}
      </span>
    </div>
  )
}
