import { Routes, Route } from 'react-router-dom'

import Layout from './components/Layout'

import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'


function App() {

  return (

    <Layout>

      <Routes>

        <Route path="/" element={<Dashboard />} />

        <Route path="/clients" element={<Clients />} />

      </Routes>

    </Layout>

  )

}

export default App