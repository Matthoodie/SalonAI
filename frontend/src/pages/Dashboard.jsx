import DashboardCard from '../components/DashboardCard'

function Dashboard() {
  return (
    <div className="dashboard">

      <section className="card">
        <h2>Današnji termini</h2>

        <ul>
          <li>09:00 - Marko - Šišanje</li>
          <li>10:30 - Ana - Bojanje</li>
          <li>12:00 - Ivan - Brijanje</li>
        </ul>

      </section>


      <section className="card">
        <h2>Današnji prihod</h2>

        <p className="value">
          126 €
        </p>

      </section>


      <section className="card">
        <h2>Zaposlenici</h2>

        <p>
          Aktivni zaposlenici: 3
        </p>

      </section>

    </div>
  )
}

export default Dashboard