import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router'
import App from './App'
import CreateProjectDynamic from './components/CreateProjectDynamic'
import { DynamicDatasetPage, DynamicModelPage, DynamicPreparationPage } from './components/DynamicProjectFlow'
import '@xyflow/react/dist/style.css'
import './styles.css'
import './projects.css'
import './carbon-friendly.css'
import './dynamic-project.css'

function RoutedExperience() {
  const { pathname } = useLocation()

  if (pathname === '/crear') return <CreateProjectDynamic />
  if (pathname === '/dataset') return <DynamicDatasetPage />
  if (pathname === '/preparacion') return <DynamicPreparationPage />
  if (pathname === '/modelo') return <DynamicModelPage />

  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <RoutedExperience />
    </BrowserRouter>
  </StrictMode>,
)
