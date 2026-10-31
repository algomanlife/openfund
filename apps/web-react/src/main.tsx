import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import Landing from './pages/Landing'
import Terminal from './pages/Terminal'

const router = createHashRouter([
  { path: '/', element: <Landing /> },
  { path: '/terminal', element: <Terminal /> }
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
