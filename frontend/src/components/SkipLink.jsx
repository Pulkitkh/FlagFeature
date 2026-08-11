import { useT } from '../context/LanguageContext'

/**
 * Reaching the flags table with a keyboard otherwise costs a tab through the
 * whole nav rail and header on every single page. This is the first thing in
 * the tab order and jumps straight past them; it is invisible until focused,
 * so it costs a mouse user nothing.
 */
export default function SkipLink() {
  const t = useT()

  return (
    <a href="#main-content" className="skip-link">
      {t('skipToContent')}
    </a>
  )
}
