import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import { Toaster } from './components/ui/toaster'
import { Spinner } from './components/ui/spinner'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Projects = lazy(() => import('./pages/Projects'))
const Iterations = lazy(() => import('./pages/Iterations'))
const SqlManagement = lazy(() => import('./pages/SqlManagement'))
const Reports = lazy(() => import('./pages/Reports'))
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
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>} />
          <Route path="projects" element={<Suspense fallback={<PageFallback />}><Projects /></Suspense>} />
          <Route path="iterations" element={<Suspense fallback={<PageFallback />}><Iterations /></Suspense>} />
          <Route path="sql" element={<Suspense fallback={<PageFallback />}><SqlManagement /></Suspense>} />
          <Route path="reports" element={<Suspense fallback={<PageFallback />}><Reports /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<PageFallback />}><Settings /></Suspense>} />
        </Route>
      </Routes>
      <Toaster />
    </>
  )
}

export default App
