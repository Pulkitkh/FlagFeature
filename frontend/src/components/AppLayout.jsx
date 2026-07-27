import { useState } from 'react'
import Navbar from './Navbar'
import Sidebar from './Sidebar'

/**
 * One place for the page chrome. Pages used to each render their own scroll
 * container and navbar, which is how their headers drifted out of alignment.
 */
export default function AppLayout({ title, breadcrumb, children }) {
  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar mobileOpen={navOpen} onCloseMobile={() => setNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar title={title} breadcrumb={breadcrumb} onOpenNav={() => setNavOpen(true)} />

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-content px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="animate-rise-in">{children}</div>
          </div>
        </main>
      </div>
    </div>
  )
}
