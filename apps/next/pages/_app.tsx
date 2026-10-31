import { CodeProvenance } from '@resinya/code-provenance'
import type { AppProps } from 'next/app'

import '../styles/globals.css'

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <CodeProvenance editor={process.env.NEXT_PUBLIC_CP_EDITOR} />
      <Component {...pageProps} />
    </>
  )
}

export default MyApp
