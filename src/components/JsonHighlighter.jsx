const DARK = {
  null:        'text-gray-400',
  string:      'text-emerald-400',
  number:      'text-blue-400',
  boolean:     'text-purple-400',
  punctuation: 'text-gray-500',
  key:         'text-yellow-400',
}

const LIGHT = {
  null:        'text-gray-400',
  string:      'text-green-700',
  number:      'text-blue-600',
  boolean:     'text-purple-600',
  punctuation: 'text-gray-400',
  key:         'text-orange-600',
}

export function JsonHighlighter({ data, className = '', light = false }) {
  const c = light ? LIGHT : DARK

  function highlight(obj, indent = 0) {
    const pad = '  '.repeat(indent)

    if (obj === null) return <span className={c.null}>null</span>
    if (typeof obj === 'string') return <span className={c.string}>"{obj}"</span>
    if (typeof obj === 'number') return <span className={c.number}>{obj}</span>
    if (typeof obj === 'boolean') return <span className={c.boolean}>{obj ? 'true' : 'false'}</span>

    if (Array.isArray(obj)) {
      if (!obj.length) return <span className={c.punctuation}>[]</span>
      return (
        <span>
          <span className={c.punctuation}>[</span><br />
          {obj.map((item, i) => (
            <span key={i}>
              {pad}  {highlight(item, indent + 1)}
              {i < obj.length - 1 && <span className={c.punctuation}>,</span>}
              <br />
            </span>
          ))}
          {pad}<span className={c.punctuation}>]</span>
        </span>
      )
    }

    if (typeof obj === 'object') {
      const entries = Object.entries(obj)
      if (!entries.length) return <span className={c.punctuation}>{'{}'}</span>
      return (
        <span>
          <span className={c.punctuation}>{'{'}</span><br />
          {entries.map(([k, v], i) => (
            <span key={k}>
              {pad}  <span className={c.key}>"{k}"</span>
              <span className={c.punctuation}>: </span>
              {highlight(v, indent + 1)}
              {i < entries.length - 1 && <span className={c.punctuation}>,</span>}
              <br />
            </span>
          ))}
          {pad}<span className={c.punctuation}>{'}'}</span>
        </span>
      )
    }

    return <span className={c.punctuation}>{String(obj)}</span>
  }

  return (
    <pre className={`whitespace-pre-wrap break-all text-[11px] leading-relaxed font-mono ${className}`}>
      <code>{highlight(data)}</code>
    </pre>
  )
}
