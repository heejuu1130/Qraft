import type { CSSProperties } from "react"

const issueSectionBreakPattern = /\n(?=1[.)]\s*쟁점\s*:)/

export const formatSummaryForDisplay = (summary: string) =>
  summary
    .replace(/\r\n/g, "\n")
    .trim()
    .replace(/\s+(?=(?:[1-3][.)]\s*)?(?:쟁점|변화|생각할\s*점)\s*:)/g, "\n")
    .replace(/\s+(?=(?:[1-9]|10)[.)]\s)/g, "\n")
    .replace(/(^|\n)\s*(?:1[.)]\s*)?쟁점\s*:/g, (_match: string, prefix: string) => `${prefix}1. 쟁점:`)
    .replace(/(^|\n)\s*(?:2[.)]\s*)?변화\s*:/g, (_match: string, prefix: string) => `${prefix}2. 변화:`)
    .replace(/(^|\n)\s*(?:3[.)]\s*)?생각할\s*점\s*:/g, (_match: string, prefix: string) => `${prefix}3. 생각할 점:`)
    .replace(/\s+(?=2[.)]\s*변화\s*:)/g, "\n")
    .replace(/\s+(?=3[.)]\s*생각할\s*점\s*:)/g, "\n")
    .replace(/\n+(?=1[.)]\s*쟁점\s*:)/, "\n")
    .replace(/\n{3,}/g, "\n\n")

type SummaryTextProps = {
  className: string
  style?: CSSProperties
  summary: string
}

export function SummaryText({ className, style, summary }: SummaryTextProps) {
  const formattedSummary = formatSummaryForDisplay(summary)
  const [intro, issueSection] = formattedSummary.split(issueSectionBreakPattern)

  if (!issueSection) {
    return (
      <p className={`${className} whitespace-pre-line`} style={style}>
        {formattedSummary}
      </p>
    )
  }

  return (
    <p className={className} style={style}>
      <span className="block whitespace-pre-line">{intro}</span>
      <span className="mt-2 block whitespace-pre-line">{issueSection}</span>
    </p>
  )
}
