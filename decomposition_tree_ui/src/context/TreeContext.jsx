import {
  createContext,
  useContext,
  useState,
  useEffect
} from "react";

import {
  getSplitData,
  getTotalSales
} from "../api/api";

const TreeContext = createContext();

const ALL_DIMS = [
  "year",
  "month",
  "payment_type",
  "vendor_id",
  "time_bucket",
  "day",
];

export const TreeProvider = ({ children }) => {

  const [kpi,setKPI] = useState("");

  const [levels,setLevels] = useState([]);
  const [path,setPath] = useState([]);

  const [availableDims,setAvailableDims] =
    useState(ALL_DIMS);

  const [currentDim,setCurrentDim] =
    useState("");

  const [loading,setLoading] =
    useState(false);

  const [selectedValue,setSelectedValue] =
    useState("");

  const [selectedTable, setSelectedTable] = useState("");
  

  const buildFilters = (p)=>{
    const f={};
    p.forEach(x=>{
      f[x.dim]=x.value;
    });
    return f;
  };

  const fetchRoot = async ()=>{
    const res = await getTotalSales(
      "taxi_gold",
      kpi
    );

    return {
      dim:kpi,
      items:[{
        node_name:"Total",
        value:res.total
      }]
    };
  };

  useEffect(()=>{
    if(!kpi) return;
    rebuildTree();
  },[kpi]);

  const rebuildTree = async ()=>{

    

    // Save structure
  const dimsToReplay =
    levels
      .slice(1)        // skip L0
      .map(l => l.dim);


    const savedPath=[...path];

    // Start fresh levels
    let newLevels=[];

    // --- ROOT ---
    const rootLevel = await fetchRoot();
    newLevels=[rootLevel];
    setLevels(newLevels);

    // --- Replay splits ---
    let replayPath=[];

    for(let i=0;i<dimsToReplay.length;i++){

      const dim=dimsToReplay[i];

      const data = await getSplitData({
        table:"taxi_gold",
        kpi_metric:kpi,
        split_col:dim,
        filters:buildFilters(replayPath)
      });

      newLevels=[
        ...newLevels,
        {dim,items:data}
      ];

      setLevels([...newLevels]);

      if(savedPath[i]){
        replayPath.push(savedPath[i]);
      }
    }

    setPath(savedPath);

    const usedDims =
      newLevels
        .map(l=>l.dim)
        .filter(d=>d!=="Total");

    setAvailableDims(
      ALL_DIMS.filter(
        d=>!usedDims.includes(d)
      )
    );

    setCurrentDim(
      usedDims[usedDims.length-1] || ""
    );

    setLoading(false);
  };

  // ---------- DRILL ----------
  const drillDown = ()=>{
    if(!selectedValue) return path;

    const newPath=[
      ...path,
      {dim:currentDim,value:selectedValue}
    ];

    setPath(newPath);
    setSelectedValue("");

    return newPath;
  };

  const fetchSplit = async(
    dim,
    overridePath=null
  )=>{

    if(!kpi||!dim) return;

    const activePath =
      overridePath ?? path;

    setLoading(true);

    const data = await getSplitData({
      table:"taxi_gold",
      kpi_metric:kpi,
      split_col:dim,
      filters:buildFilters(activePath)
    });

    const newLevels=[
      ...levels,
      {dim,items:data}
    ];

    setLevels(newLevels);
    setCurrentDim(dim);

    setAvailableDims(prev=>
      prev.filter(d=>d!==dim)
    );

    setLoading(false);
  };

  const resetTree = async ()=>{
    setPath([]);
    setAvailableDims(ALL_DIMS);
    setSelectedValue("");
    setCurrentDim("");

    const root = await fetchRoot();
    setLevels([root]);
  };

  const closeLevel=(levelIndex)=>{

    const newLevels =
      levels.slice(0,levelIndex);

    setLevels(newLevels);
    
    const usedDims =
    newLevels
    .map(l=>l.dim)
    .filter(d=>d!=="Total");
  
    console.log("useddimes is ",usedDims)
    const newPath = path.slice(0, Math.max(0, usedDims.length-2));
    setPath(newPath);

    setAvailableDims(
      ALL_DIMS.filter(
        d=>!usedDims.includes(d)
      )
    );

    setCurrentDim(
      usedDims[usedDims.length-1] || ""
    );

    setSelectedValue("");
  };

  return(
    <TreeContext.Provider value={{

      kpi,setKPI,

      levels,
      path,

      loading,

      availableDims,

      selectedValue,
      setSelectedValue,

      drillDown,
      fetchSplit,
      resetTree,
      closeLevel

    }}>
      {children}
    </TreeContext.Provider>
  );
};

export const useTree =
  ()=>useContext(TreeContext);
