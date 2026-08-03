export default function Card({ children, className = '', padded = true, ...props }) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface shadow-hairline ${
        padded ? 'p-4' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
