import "./Footer.scss";

const Footer = () => {
    return(
        <>
            <div className="footer">
                <div className="footer-1">
                    <div className="footer-img">
                        <div className="footer-img1">
                            <img src="/databricks-logo.png" alt="logo-err" />
                        </div>
                        <div className="footer-images-container">
                            <img src="/python-logo.png" alt="logo-err" />
                            <img src="/react-logo.png" alt="logo-err" />
                        </div>
                    </div>
                    <div className="footer-info">
                        <div className="footer-info-1">
                            Data from NYC Taxi Dataset 2015-2016 publicly available in <span style={{color : "#20BEFF"}}>Kaggle</span>.
                        </div>
                        <div className="links">
                            <div className="link-box-1">
                                <a href="https://www.kaggle.com/datasets/elemento/nyc-yellow-taxi-trip-data" target="_blank" rel="noopener noreferrer">See Dataset</a>
                                <a href="https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-decomposition-tree" target="_blank" rel="noopener noreferrer">Decomposition tree</a>
                            </div>
                            <div className="link-box-2">
                                <a href="https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page" target="_blank" rel="noopener noreferrer">NYC Taxi</a>
                                <a href="https://github.com/mrChr0matic/databricks-decomposition-app" target="_blank" rel="noopener noreferrer">Github Repo</a>
                                <a href="https://www.sigmoid.com/" target="_blank" rel="noopener noreferrer">About Us</a>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="footer-2">NYC Taxi : All Rights Reserved ©</div>
            </div>
        </>
    )
}

export default Footer;