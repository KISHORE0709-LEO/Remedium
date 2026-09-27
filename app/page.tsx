import { Audiences } from '@/components/marketing/audiences'
import { Closing, Footer } from '@/components/marketing/closing'
import { Hero } from '@/components/marketing/hero'
import { SiteNav } from '@/components/marketing/site-nav'
import { Story } from '@/components/marketing/story'

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <Story />
        <Audiences />
        <Closing />
      </main>
      <Footer />
    </>
  )
}
