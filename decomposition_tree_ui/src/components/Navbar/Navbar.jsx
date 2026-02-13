import { useState } from "react";
import "./Navbar.scss";
import KPI_Selector from "../KPI_Selector/KPI_Selector";
import { useTree } from "../../context/TreeContext";

const Navbar = () => {

  const tables = ["taxi_gold"];

  const {selectedTable, setSelectedTable} = useTree();

  return (
    <div className="fitting">
        <div className="navbar">
            <div className="nav">

                <div className="logo">
                <img src="./taxi.png" alt="logo-err"/>
                </div>

                <KPI_Selector/>

                <select
                value={selectedTable}
                onChange={(e)=>setSelectedTable(e.target.value)}
                className="table-dropdown"
                >
                <option value="">Select Table</option>

                {tables.map(table => (
                    <option key={table} value={table}>
                    {table}
                    </option>
                ))}

                </select>

            </div>
        </div>
    </div>
  );
};

export default Navbar;
