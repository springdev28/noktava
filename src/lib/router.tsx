import { createContext, useContext, useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react'
const RouterContext = createContext({ path: '/', navigate: (_path: string) => {} })
export function Router({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(() => location.hash === '#workspace' ? '/studio' : location.pathname)
  const navigate = (next: string) => {
    history.pushState(null, '', next); setPath(new URL(next, location.href).pathname)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  useEffect(() => {
    if (location.hash === '#workspace') history.replaceState(null, '', '/studio')
    const pop = () => { setPath(location.pathname); window.scrollTo({ top: 0, behavior: 'instant' }) }
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])
  return <RouterContext.Provider value={{ path, navigate }}>{children}</RouterContext.Provider>
}
export const useRouter = () => useContext(RouterContext)
export function Link({ href = '/', onClick, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { navigate } = useRouter()
  return <a {...props} href={href} onClick={e => {
    onClick?.(e)
    if (!e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !props.target && href.startsWith('/')) { e.preventDefault(); navigate(href) }
  }}>{children}</a>
}
