import { useEffect, useState } from 'react'
import { getAppLanguage, subscribeLanguage, t as translate } from '../i18n'

/** Reactive translations bound to Settings language. */
export function useI18n() {
  const [lang, setLang] = useState(getAppLanguage)

  useEffect(() => subscribeLanguage(setLang), [])

  const t = (key) => translate(key, lang)
  return { lang, t }
}
