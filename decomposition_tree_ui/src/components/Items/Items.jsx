import './items.scss'
import { useTree } from "../../context/TreeContext";


const Items = () => {
  const { path, levels, closeLevel } = useTree();

  const isInPath = (dim,value)=>{
    return path.some(p =>
      String(p.dim).toLowerCase().trim()
        === String(dim).toLowerCase().trim()
      &&
      String(p.value).toLowerCase().trim()
        === String(value).toLowerCase().trim()
    );
  };


  return (
    <div className="tree-container">
      {levels.map((level, idx) => {
        {{console.log("debug",path, "level", levels)}}
        const total = level.items.reduce((s,i)=>s+i.value,0);

        return (
          <div className="level" key={idx}>
            <div className="level-top">
              <h4 className='dim-title'>{level.dim}</h4>
              <div className="close-button" onClick={()=>closeLevel(idx)}>
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
            <hr className='underline'/>
            {level.items.map(item => {
              const pct = (item.value/total)*100;

              return (
                <div className="item" key={item.node_name}>
                  <div className="content">
                    <div>
                      <span>{item.node_name} </span>
                      <span className="percentage">{pct.toFixed(2)}%</span>
                    </div>
                    <div>{Number(item.value,2).toFixed(2)}</div>
                  </div>

                  <div className="box">
                    <div
                      className={idx === 0 || isInPath(level.dim, item.node_name) ? `bar-selected` : `bar-fill`}
                      style={{width:`${pct}%`}}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default Items;
