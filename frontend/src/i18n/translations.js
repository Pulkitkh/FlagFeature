/**
 * The locale registry.
 *
 * Imports are explicit rather than `import.meta.glob` so the same module works
 * under plain Node — that's what lets `npm run check:i18n` verify the
 * catalogue without a bundler or a test runner.
 *
 * `en` is the complete catalogue and the fallback: any key a locale doesn't
 * define falls through to English rather than rendering the raw key, so a
 * partially translated locale degrades into a readable mixed interface instead
 * of a broken one.
 */
import en from './locales/en.js'

import hi from './locales/hi.js'
import bn from './locales/bn.js'
import mr from './locales/mr.js'
import te from './locales/te.js'
import ta from './locales/ta.js'
import gu from './locales/gu.js'
import ur from './locales/ur.js'
import kn from './locales/kn.js'
import or from './locales/or.js'
import ml from './locales/ml.js'
import pa from './locales/pa.js'
import as from './locales/as.js'
import mai from './locales/mai.js'
import sa from './locales/sa.js'
import ne from './locales/ne.js'
import si from './locales/si.js'

import es from './locales/es.js'
import fr from './locales/fr.js'
import de from './locales/de.js'
import pt from './locales/pt.js'
import it from './locales/it.js'
import nl from './locales/nl.js'
import ru from './locales/ru.js'
import uk from './locales/uk.js'
import pl from './locales/pl.js'
import cs from './locales/cs.js'
import sv from './locales/sv.js'
import hu from './locales/hu.js'
import ro from './locales/ro.js'
import el from './locales/el.js'
import tr from './locales/tr.js'
import ar from './locales/ar.js'
import fa from './locales/fa.js'
import he from './locales/he.js'
import zh from './locales/zh.js'
import zhTW from './locales/zh-TW.js'
import ja from './locales/ja.js'
import ko from './locales/ko.js'
import vi from './locales/vi.js'
import th from './locales/th.js'
import my from './locales/my.js'
import id from './locales/id.js'
import ms from './locales/ms.js'
import fil from './locales/fil.js'
import sw from './locales/sw.js'

const translations = {
  hi, bn, mr, te, ta, gu, ur, kn, or, ml, pa, as, mai, sa, ne, si,
  es, fr, de, pt, it, nl, ru, uk, pl, cs, sv, hu, ro, el, tr,
  ar, fa, he, zh, 'zh-TW': zhTW, ja, ko, vi, th, my, id, ms, fil, sw,
}

export { en }

/**
 * The catalogue for a locale, with English filled in behind it. Doing the
 * merge once per language change (rather than per lookup) keeps `t()` a plain
 * object read.
 */
export function catalogFor(code) {
  return code === 'en' ? en : { ...en, ...(translations[code] || {}) }
}

export default translations
