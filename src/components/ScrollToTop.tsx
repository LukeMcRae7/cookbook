import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Every route change should start at the top, like a real app. */
export function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])

  return null
}
