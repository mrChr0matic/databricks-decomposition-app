import { useState } from 'react'
import './App.css'
import Controls from './components/Controls/Controls'
import Items from './components/Items/Items'
import Navbar from './components/Navbar/Navbar'
import KPI_Selector from './components/KPI_Selector/KPI_Selector'
import { TreeProvider } from './context/TreeContext'

function App() {
  const [globalKPI, setGlobalKPI] = useState("");
  console.log(globalKPI)

  return (
    <TreeProvider>
      <Navbar/>
      <Items/>
      <Controls/>
    </TreeProvider>
  )
}

export default App
