'use client'

import { useState } from 'react'

export default function ClientCard() {
  const [clicks, setClicks] = useState(0)
  return <button id="client-target" onClick={() => setClicks(clicks + 1)}>
    Client Component clicks: {clicks}
  </button>
}
