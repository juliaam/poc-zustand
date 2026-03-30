import { marked } from 'marked'
import analysisRaw from '../../ANALYSIS.md?raw'

const html = marked(analysisRaw) as string

export function AnalysisViewer() {
  return (
    <div
      className="markdown-body"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
