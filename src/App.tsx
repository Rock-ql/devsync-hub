import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Toaster } from './components/ui/toaster'
import { Spinner } from './components/ui/spinner'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Projects = lazy(() => import('./pages/Projects'))
const Iterations = lazy(() => import('./pages/Iterations'))
const SqlManagement = lazy(() => import('./pages/SqlManagement'))
const Reports = lazy(() => import('./pages/Reports'))
const ConsolePage = lazy(() => import('./pages/Console'))
const Settings = lazy(() => import('./pages/Settings'))

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner className="h-6 w-6 text-muted-foreground" />
    </div>
  )
}

function App() {
  return (
    <>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Suspense fallback={<PageFallback />}><ErrorBoundary><Dashboard /></ErrorBoundary></Suspense>} />
            <Route path="projects" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><Projects /></ErrorBoundary></Suspense>} />
            <Route path="iterations" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><Iterations /></ErrorBoundary></Suspense>} />
            <Route path="sql" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><SqlManagement /></ErrorBoundary></Suspense>} />
            <Route path="reports" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><Reports /></ErrorBoundary></Suspense>} />
            <Route path="console" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ConsolePage /></ErrorBoundary></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><Settings /></ErrorBoundary></Suspense>} />
          </Route>
        </Routes>
      </ErrorBoundary>
      <Toaster />
    </>
  )
}

export default App
