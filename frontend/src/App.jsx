import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'

import { clients } from './data/clients'

import Layout from './components/Layout/Layout'

import Appointments from './pages/Appointments/Appointments'
import Clients from './pages/Clients/Clients'
import Dashboard from './pages/Dashboard/Dashboard'

function App() {
  const [clientList, setClientList] = useState(() => {
    const savedClients = localStorage.getItem('salonai-clients')

    if (savedClients) {
      return JSON.parse(savedClients)
    }

    return clients
  })

  useEffect(() => {
    localStorage.setItem(
      'salonai-clients',
      JSON.stringify(clientList)
    )
  }, [clientList])

  return (
    <Layout>
      <Routes>
        <Route
          path="/"
          element={<Dashboard />}
        />

        <Route
          path="/clients"
          element={
            <Clients
              clientList={clientList}
              setClientList={setClientList}
            />
          }
        />

        <Route
          path="/appointments"
          element={<Appointments />}
        />
      </Routes>
    </Layout>
  )
}

export default App