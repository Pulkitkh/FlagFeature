export default function Card({ children, className = '', padded = true, ...props }) {
  return (
    <div
      className={`rounded-2xl border border-white/80 bg-surface/80 shadow-card backdrop-blur-sm ${
        padded ? 'p-4' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
