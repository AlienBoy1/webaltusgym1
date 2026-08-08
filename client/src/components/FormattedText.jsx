/**
 * Render challenge/post description body text:
 * - preserves line breaks
 * - *word or phrase* → bold
 */
export default function FormattedText({ text, className = '' }) {
  if (text == null || text === '') return null

  const lines = String(text).split('\n')

  return (
    <div className={className}>
      {lines.map((line, lineIdx) => {
        const parts = line.split(/(\*[^*]+\*)/g)
        return (
          <p key={lineIdx} className={lineIdx > 0 ? 'mt-1.5' : undefined}>
            {parts.length === 1 && parts[0] === '' ? (
              <br />
            ) : (
              parts.map((part, i) => {
                if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
                  return (
                    <strong key={i} className="font-semibold text-inherit">
                      {part.slice(1, -1)}
                    </strong>
                  )
                }
                return <span key={i}>{part}</span>
              })
            )}
          </p>
        )
      })}
    </div>
  )
}
